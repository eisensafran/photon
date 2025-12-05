# photon

Online tool to create intensity graphs from smartphone images for hands-on spectroscopy in the classroom. Currently in active development. Working demo under: [https://scinotes.org/photon/](https://scinotes.org/photon/). More info and a complete project description can be found [here](https://andi-siess.de/project-lambda/). 

### Features
- loading images as *.png or *.jpg
- function to rotate the image
- manual probe mode to determine the brightness values at predetermined locations in the image
- automatic probe mode by drawing a horizontal *probe line*
- automatic histogram creation with the values from the *probe line*
- function to place markers at local maxima on the histogram with automatic snapping
- function to scale and move the x-axis
- quick calculator to convert wavelength to energy and vice versa
- csv export of the histogram data
- image export of the histogram 

### Known issues
- the quickinfo overlay is also displayed when the cursor hovers over the histogram
- the SVG icon for the button "Messline setzen" (draw probe line) is not displayed at the moment
- the histogram is currently not responsive to narrow screens 
- the icons in the `details`-section are too small/tiny

### Standalone app
A standalone Electron-powered app is in very early alpha state [https://github.com/eisensafran/photon-electron](https://github.com/eisensafran/photon-electron). 
