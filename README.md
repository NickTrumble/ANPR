# Automatic Number Plate Recognition

A browser-based image-processing experiment for locating likely vehicle number plates. Select one or more local images in the page and the pipeline produces cropped candidate regions.

## Pipeline

1. Convert the image to greyscale.
2. Apply a 3 by 3 Gaussian blur.
3. Find edges with Sobel filters and threshold the result.
4. Extract connected contours.
5. Filter candidates by aspect ratio, size, edge density, and an approximate character count.

The project identifies plate-sized regions only; it does not perform optical character recognition.

## Running

Open `index.html` in a modern browser and use the image picker. No server or package installation is required.

## Test images

The included sample images came from the [OpenALPR benchmark set](https://github.com/openalpr/benchmarks/tree/master/endtoend/eu).
