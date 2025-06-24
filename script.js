let btn = document.getElementById('imageAdder')

btn.addEventListener('click', () =>{
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.click();


    input.onchange = async (event) => {
        for (let file of event.target.files){
            if (file){
                let picture = URL.createObjectURL(file);
                let bmp = await imageToBitmap(picture);
                Main(bmp);
            }
        }
    }
})

async function imageToBitmap(imgSrc){
    let response = await fetch(imgSrc);
    let blob = await response.blob();
    let bitmap = await createImageBitmap(blob);
    return bitmap
}

async function Main(bmp){
    let container = document.getElementById('container')

    let secretCanvas = document.createElement('canvas');
    secretCanvas.width = bmp.width;
    secretCanvas.height = bmp.height;

    let ctx = secretCanvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);

    let imageData = ctx.getImageData(0, 0, secretCanvas.width, secretCanvas.height);
    let grayData = grayScale(imageData);
    let gaussianData = gaussian(grayData);
    let sobelData = sobelEdges(structuredClone(gaussianData));
    let binarized = binarize(sobelData);
    ctx.putImageData(binarized, 0, 0);

    let contours = detectContours(binarized, ctx);
    let plates = detectPlates(contours, ctx, imageData);

    ctx.drawImage(bmp, 0, 0);
    for (let plate of plates){
        let plateCanvas = document.createElement('canvas');
        plateCanvas.className = 'centered';
        let ctx2 = plateCanvas.getContext('2d');
        plateCanvas.width = plate.width;
        plateCanvas.height = plate.height;
        let plateData = ctx.getImageData(plate.x, plate.y, plate.width, plate.height);
        ctx2.putImageData(plateData, 0, 0);
        container.append(plateCanvas);
    }
}

function grayScale(imageData){
    let data = imageData.data;
    for (let i = 0; i < data.length; i+= 4) {
        let r = 0.299 * data[i];
        let g = 0.587 * data[i + 1];
        let b = 0.114 * data[i + 2];

        let grey = r + g + b;
        data[i] = data[i + 1] = data[i + 2] = grey;
    }
    return imageData;
}

function gaussian(imageData){

    function createGaussianKernel(size, sigma = 1){
        let kernel = new Array(size).fill(0).map(() => new Array(size).fill(0));
        let center = Math.floor(size / 2)
        let kernelWeight = 0;
        
        for (let i = 0; i < size; i ++){
            for (let j = 0; j < size; j++){
                let x = i - center;
                let y = j - center;
                let coefficient = 1 / (2 * Math.PI * sigma * sigma);
                let exp = -(x * x + y * y) / (2 * sigma * sigma);
                let val = Math.exp(exp) * coefficient;
                kernel[i][j] = val;
                kernelWeight += val;
            }
        }
        return {kernel, kernelWeight};
    }

    let size = 3;
    let {kernel, kernelWeight} = createGaussianKernel(size, 1.5);
    let {data, width, height} = imageData;
    let tempData = new Uint8ClampedArray(data.length);

    let bounds = Math.floor(size / 2);

    for (let j = bounds; j < height - bounds; j++){
        for (let i = bounds; i < width - bounds; i++){
            let r = 0.0, g = 0.0, b = 0.0;

            for (let x = -bounds; x <= bounds; x++){
                for (let y = -bounds; y <= bounds; y++){
                    let kIndex = (j + y) * width + i + x;
                    let weight = kernel[x + bounds][y + bounds];

                    r += data[kIndex * 4] * weight;
                    g += data[kIndex * 4 + 1] * weight;
                    b += data[kIndex * 4 + 2] * weight;
                }
            }

            let pIndex = (j * width + i) * 4;
            tempData[pIndex] = r / kernelWeight;
            tempData[pIndex + 1] = g / kernelWeight;
            tempData[pIndex + 2] = b / kernelWeight;
            tempData[pIndex + 3] = data[pIndex + 3];

        }
    }
    for (let i = 0; i < data.length; i++){
        data[i] = tempData[i];
    }
    return imageData;
}

function sobelEdges(imageData){
    let kernelx = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];
    let kernely = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];
    let {data, width, height} = imageData;
    let magnitudes = [];
    let maxMag = 0;
    let gx = 1; let gy = 1;
    for (let j = 1; j < height - 1; j++){
        for (let i = 1; i < width - 1; i++){
            gx = 0;
            gy = 0;
            for (let x = -1; x <= 1; x++){
                for (let y = -1; y <= 1; y++){
                    let kIndex = ((j + y) * width + i + x) * 4;
                    gx += (data[kIndex] * kernelx[x + 1][y + 1]);
                    gy += (data[kIndex] * kernely[x + 1][y + 1]);
                }
            }
 
            let pIndex = j * width + i;
            let mag = Math.sqrt(gx * gx + gy * gy);
            magnitudes[pIndex] = mag;
            if (maxMag < magnitudes[pIndex])
                maxMag = magnitudes[pIndex];

        }
    }

    for (let i = 0; i < magnitudes.length; i++){
        let normMag = (magnitudes[i] / maxMag) * 255;
        let u = i * 4;
        data[u] = data[u + 1] = data[u + 2] = normMag;
        data[u + 3] = 255;
    }
    return imageData;
}

function binarize(imageData, threshold = 50){
    let data = imageData.data;
    for (let i = 0; i < data.length; i+= 4){
        let val = (data[i] > threshold) ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = val;
    }
    return imageData;
}

function detectContours(imageData, ctx){

    function dfsFill(x, y){
        let queue = [[x, y]]
        let minx = maxx = x;
        let miny = maxy = y;

        while(queue.length > 0){
            let [cx, cy] = queue.pop();
            if (visited[cy * width + cx] || data[4 * (cy * width + cx)] != 255)
                continue;

            minx = Math.min(cx, minx);
            miny = Math.min(cy, miny);
            maxx = Math.max(cx, maxx);
            maxy = Math.max(cy, maxy);

            visited[cy * width + cx] = 1;

            queue.push([cx + 1, cy], [cx, cy + 1], [cx - 1, cy], [cx, cy - 1]);
        }

        contours.push({x: minx, y: miny, width: maxx - minx, height: maxy - miny});
    }
    
    let contours = [];
    let { data, width, height} = imageData;
    let visited = new Uint8Array(width * height);

    for (let i = 0; i < width; i++){
        for (let j = 0; j < height; j++){
            if (!visited[j * width + i] && data[4 * (j * width + i)] == 255){
                dfsFill(i, j);
            }
        }
    }

    return contours;
}

function detectPlates(contours, ctx, imageData){
    function edgeFiltered(candidates){
        let bettercandidates = [];
        for (let candidate of candidates){
            let {x, y, width, height} = candidate;
            let edgeCount = 0;
            for (let i = x; i < x + width; i++){
                for (let j = y; j < y + height; j++){
                    let index = 4 * (j * imageData.width + i);
                    if (imageData.data[index] > 128)
                        edgeCount++;
                }
            }
            if (edgeCount / (width * height) > 0.1)
                bettercandidates.push(candidate);
        }
        
        console.log(bettercandidates.length + ', ' + candidates.length);
        return bettercandidates;        
    }



    let plates = [];
    let secondCandidates = [];
    let candidates = [];
    for (let contour of contours){
        let area = contour.width * contour.height;
        let aspect = contour.width / contour.height;
        if (aspect < 5.5 && aspect > 3 && area < 80000 && area > 5000){
            candidates.push(contour);
        }
    }

    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    for (let plate of candidates){
        ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
    }

    secondCandidates = edgeFiltered(candidates);

    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    for (let plate of secondCandidates){
        ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
    }

    for (let plate of secondCandidates){
        let canadidateData = ctx.getImageData(plate.x, plate.y, plate.width, plate.height);
        let characters = detectContours(canadidateData, ctx).length;
        if (characters > 5 && characters < 30){
            plates.push(plate);
        }
    }


    ctx.strokeStyle = 'green';
    ctx.lineWidth = 3;
    for (let plate of plates){
        ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
    }

    return plates;
}