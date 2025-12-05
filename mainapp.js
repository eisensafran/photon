class ImageAnalysisTool {
  constructor() {
    // === IMAGE CANVAS & CONTEXT ===
    this.canvas = document.getElementById("imageCanvas");
    this.ctx = this.canvas.getContext("2d");

    // === ROTATION MODAL CANVAS & CONTEXT ===
    this.modalCanvas = document.getElementById("modalCanvas");
    this.modalCtx = this.modalCanvas.getContext("2d");

    // === GRAPH SVG (D3) ===
    this.graphSvg = d3.select("#graphSvg");
    this.svgNode = this.graphSvg.node();
    this.svgWidth = +this.svgNode.getAttribute("width");
    this.svgHeight = +this.svgNode.getAttribute("height");

    this.graphData = null;
    this.graphBounds = null;
    this.graphMarkers = [];
    this.xAxisContainer = null;
    
    // State for Graph 2 transforms (Pixel Graph)
    this.g2AppliedShift = 0;
    this.g2AppliedScale = 1.0;

    this.tooltip = document.getElementById("tooltip");

    // IMAGE & STATE
    this.image = null;
    this.imageData = null;
    this.probeLineY = null;
    this.isPlacingProbe = false;
    this.measurements = [];
    this.measurementCounter = 0;
    this.selectMode = false;

    // BUTTON / INPUT ELEMENTS
    this.fileInput = document.getElementById("fileInput");
    this.rotateBtn = document.getElementById("rotateBtn");
    this.probeLineBtn = document.getElementById("probeLineBtn");
    this.graph2Btn = document.getElementById("graph2Btn");
    this.resetBtn = document.getElementById("resetBtn");
    this.deleteLastMarkerBtn = document.getElementById("deleteLastMarkerBtn");


    this.lambdaBtn = document.getElementById('lambdaCalcBtn');
    this.lambdaInput = document.getElementById('lambdaInput');
    this.lambdaOutput = document.getElementById('lambdaOutputResult');

    this.energyBtn = document.getElementById('energyCalcBtn');
    this.energyInput = document.getElementById('energyInput');
    this.energyOutput = document.getElementById('energyOutputResult');

    // TRANSFORM CONTROLS - GRAPH 2
    this.graph2TransformControls = document.getElementById("graph2TransformControls");
    this.g2XShiftInput = document.getElementById("g2XShiftInput");
    this.g2XScaleInput = document.getElementById("g2XScaleInput");
    this.g2ApplyBtn = document.getElementById("g2ApplyBtn");
    

    // PEAK FINDING
    this.peakSearchRadius = 15; // Search radius in data-space (image pixels) 

    // ROTATION MODAL ELEMENTS
    this.rotationModal = document.getElementById("rotationModal");
    this.rotationInput = document.getElementById("rotationInput");
    this.abortBtn = document.getElementById("abortBtn");
    this.okBtn = document.getElementById("okBtn");
    this.closeModalSpan = document.querySelector(".close");

    // GRAPH CONTAINER
    this.graphContainer = document.getElementById("graphContainer");

    // COORDINATES OUTPUT AREA
    this.coordinatesOutput = document.getElementById("coordinatesOutput");

    // INITIAL SETUP
    this._attachEventListeners();
    this._initializeState();
  }

  _initializeState() {
    document.getElementById("selectMode").checked = false;
    this.probeLineBtn.textContent = "Messlinie setzen";
    this.graphContainer.style.display = "none";
    this.canvas.style.cursor = "default";
    this.hideTooltip();
    this.updateCoordinatesOutput();
    this.updateGraphButtons();
    this.hideGraph(); // Hides and disables all transform controls initially
  }

  _attachEventListeners() {
    //  Image Loading & Rotation 
    this.fileInput.addEventListener("change", (e) => {
      this.loadImage(e)
      this.reset();  // Triggers reset function to get rid of graph and markers when a new image is loaded
    });
    this.rotateBtn.addEventListener("click", () => this.openRotationModal());
    this.closeModalSpan.addEventListener("click", () => this.closeRotationModal());
    this.rotationInput.addEventListener("input", () => this.rotatePreview());
    this.abortBtn.addEventListener("click", () => this.closeRotationModal());
    this.okBtn.addEventListener("click", () => this.applyRotation());

    //  Main Controls 
    document.getElementById("selectMode").addEventListener("change", (e) => {
      this.selectMode = e.target.checked;
      this.updateCanvasCursor();
      this.redrawOverlays();
    });
    this.probeLineBtn.addEventListener("click", () => this.toggleProbeLine());
    // createGraphBtn listener removed
    this.graph2Btn.addEventListener("click", () => this.createGraph2());
    this.resetBtn.addEventListener("click", () => this.reset());
    this.deleteLastMarkerBtn.addEventListener("click", () => this.deleteLastMarker());

    //  Canvas Mouse Events 
    this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener("mouseleave", () => {
      if (this.isPlacingProbe) this.redrawOverlays();
      this.hideTooltip();
    });

    //  SVG Mouse Events (D3 graph) 
    this.graphSvg
      .on("mousemove", (event) => this.handleGraphMouseMove(event))
      .on("click", (event) => this.handleGraphClick(event));

    //  Transform Input & Button Listeners 
    this.g2ApplyBtn.addEventListener("click", () => this.applyG2Transform());

    // Lambda Converter
    this.lambdaBtn.addEventListener('click', () => this.lambdaConverter());
    this.energyBtn.addEventListener('click', () => this.energyConverter());
  }

  // ================================================
  //              IMAGE LOADING & DRAWING
  // ================================================
  loadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        this.imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        this.redrawOverlays();
        this.rotateBtn.disabled = false;
        this.probeLineBtn.disabled = false;
        this.updateGraphButtons();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  openRotationModal() {
    if (!this.image) return;
    this.modalCanvas.width = this.image.width;
    this.modalCanvas.height = this.image.height;
    this.modalCtx.clearRect(0, 0, this.modalCanvas.width, this.modalCanvas.height);
    this.modalCtx.drawImage(this.image, 0, 0);
    this._drawModalGrid();
    this.rotationInput.value = 0;
    this.rotationModal.style.display = "block";
  }

  closeRotationModal() {
    this.rotationModal.style.display = "none";
  }

  rotatePreview() {
    const angle = parseFloat(this.rotationInput.value) || 0;
    const radians = (angle * Math.PI) / 180;
    const w = this.image.width, h = this.image.height;
    const sin = Math.abs(Math.sin(radians)), cos = Math.abs(Math.cos(radians));
    const newW = w * cos + h * sin, newH = w * sin + h * cos;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = newW;
    tempCanvas.height = newH;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.fillStyle = "black";
    tempCtx.fillRect(0, 0, newW, newH);
    tempCtx.save();
    tempCtx.translate(newW / 2, newH / 2);
    tempCtx.rotate(radians);
    tempCtx.drawImage(this.image, -w / 2, -h / 2);
    tempCtx.restore();
    this.modalCanvas.width = newW;
    this.modalCanvas.height = newH;
    this.modalCtx.clearRect(0, 0, newW, newH);
    this.modalCtx.drawImage(tempCanvas, 0, 0);
    this._drawModalGrid();
  }

  applyRotation() {
    const angle = parseFloat(this.rotationInput.value) || 0;
    const radians = (angle * Math.PI) / 180;
    const w = this.image.width, h = this.image.height;
    const sin = Math.abs(Math.sin(radians)), cos = Math.abs(Math.cos(radians));
    const newW = w * cos + h * sin, newH = w * sin + h * cos;
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = newW;
    finalCanvas.height = newH;
    const finalCtx = finalCanvas.getContext("2d");
    finalCtx.fillStyle = "black";
    finalCtx.fillRect(0, 0, newW, newH);
    finalCtx.save();
    finalCtx.translate(newW / 2, newH / 2);
    finalCtx.rotate(radians);
    finalCtx.drawImage(this.image, -w / 2, -h / 2);
    finalCtx.restore();
    const dataURL = finalCanvas.toDataURL();
    const tempImg = new Image();
    tempImg.onload = () => {
      this.image = tempImg;
      this.canvas.width = newW;
      this.canvas.height = newH;
      this.ctx.clearRect(0, 0, newW, newH);
      this.ctx.drawImage(tempImg, 0, 0);
      this.imageData = this.ctx.getImageData(0, 0, newW, newH);
      this.probeLineY = null;
      this.isPlacingProbe = false;
      this.measurements = [];
      this.measurementCounter = 0;
      this.updateCoordinatesOutput();
      this.updateGraphButtons();
      this.redrawOverlays();
      this.closeRotationModal();
    };
    tempImg.src = dataURL;
  }

  _drawModalGrid() {
    const ctx = this.modalCtx;
    const w = this.modalCanvas.width;
    const h = this.modalCanvas.height;
    const spacing = 50;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  // ================================================
  //         PROBE LINE & MEASUREMENTS
  // ================================================
  toggleProbeLine() {
    if (!this.image) return;
    if (this.probeLineY === null && !this.isPlacingProbe) {
      this.isPlacingProbe = true;
      this.canvas.style.cursor = "crosshair";
     // this.probeLineBtn.textContent = "Messlinie setzen";
      this.redrawOverlays();
    } else if (this.probeLineY !== null) {
      this.probeLineY = null;
      this.isPlacingProbe = false;
      this.probeLineBtn.textContent = "Messlinie setzen";
      this.redrawOverlays();
      this.updateGraphButtons();
    }
  }

  handleCanvasClick(e) {
    if (!this.image) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    if (this.isPlacingProbe && this.probeLineY === null) {
      this.probeLineY = rawY;
      this.isPlacingProbe = false;
      this.canvas.style.cursor = "default";
      this.probeLineBtn.textContent = "Messlinie löschen";
      this.redrawOverlays();
      this.updateGraphButtons();
      return;
    }

    if (this.selectMode) {
      this.addMeasurement(rawX, rawY);
      this.redrawOverlays();
      this.updateCoordinatesOutput();
    }
  }

  handleCanvasMouseMove(e) {
    if (!this.image) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    if (this.isPlacingProbe && this.probeLineY === null) {
      this.redrawOverlays();
      this.ctx.strokeStyle = "rgba(255,0,0,0.7)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, rawY);
      this.ctx.lineTo(this.canvas.width, rawY);
      this.ctx.stroke();
      return;
    }

    if (!this.selectMode && this.probeLineY !== null) {
      if (Math.abs(rawY - this.probeLineY) < 5) {
        const brightness = this.getBrightness(Math.round(rawX), Math.round(this.probeLineY));
        if (brightness !== null) {
          this.showTooltip(e.clientX, e.clientY, `B: ${brightness}`);
          return;
        }
      }
    }

    if (this.selectMode) {
      const brightness = this.getBrightness(Math.round(rawX), Math.round(rawY));
      if (brightness !== null) {
        this.showTooltip(e.clientX, e.clientY, `X:${Math.round(rawX)}, Brightness: ${brightness}`);
        return;
      }
    }
    this.hideTooltip();
    if (!this.isPlacingProbe) this.redrawOverlays();
  }

  getBrightness(x, y) {
    if (!this.imageData || x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return null;
    const idx = (Math.round(y) * this.imageData.width + Math.round(x)) * 4;
    const [r, g, b] = [this.imageData.data[idx], this.imageData.data[idx + 1], this.imageData.data[idx + 2]];
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  addMeasurement(x, y) {
    const brightness = this.getBrightness(Math.round(x), Math.round(y));
    if (brightness === null) return;
    this.measurementCounter++;
    this.measurements.push({
      id: this.measurementCounter,
      canvasX: Math.round(x),
      canvasY: Math.round(y),
      imageX: Math.round((x * this.image.width) / this.canvas.width),
      imageY: Math.round((y * this.image.height) / this.canvas.height),
      brightness,
    });
  }

  redrawOverlays() {
    if (!this.image) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.image, 0, 0);

    if (this.probeLineY !== null) {
      this.ctx.strokeStyle = "red";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.probeLineY);
      this.ctx.lineTo(this.canvas.width, this.probeLineY);
      this.ctx.stroke();
    }

    this.measurements.forEach((m) => {
      this.ctx.fillStyle = "yellow";
      this.ctx.beginPath();
      this.ctx.arc(m.canvasX, m.canvasY, 5, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.fillStyle = this.selectMode ? "white" : "black";
      this.ctx.font = "12px Arial";
      this.ctx.fillText(`(${m.imageX},${m.imageY}) B:${m.brightness}`, m.canvasX + 8, m.canvasY - 8);
    });
  }

  updateCoordinatesOutput() {
    this.coordinatesOutput.innerHTML = this.measurements.length === 0
      ? "Bisher noch keine Messungen aufgezeichnet. Um Messungen im Bild vorzunehmen, verwende das Werkzeug 'Pixel messen' im Menü oben und klicke auf das geladene Bild."
      : this.measurements.map(m => `#${m.id}: Image X:${m.imageX}, Brightness: ${m.brightness}`).join('<br>');
  }

  updateGraphButtons() {
    const disabled = this.probeLineY === null;
    this.graph2Btn.disabled = disabled;
  }

  updateCanvasCursor() {
    this.canvas.style.cursor = (this.selectMode || this.isPlacingProbe) ? "crosshair" : "default";
  }

  // ================================================
  //                 D3 GRAPH SECTION
  // ================================================
  
  // createGraph() REMOVED
    // the follwing functions may still have a weird naming style ("drawGraph2") since there had been a "drawGraph1" function that was removed.
  // todo: clean up naming style and all comments 

  createGraph2() {
    if (!this.image || this.probeLineY === null) return;
    const profile = this.extractBrightnessProfile();
    this.graphData = profile;
    this.drawGraph2(profile);

    // Reset and enable Graph 2 controls
    this.g2AppliedShift = 0;
    this.g2AppliedScale = 1.0;
    this.g2XShiftInput.value = 0;
    this.g2XScaleInput.value = 1.00;
    
    // Ensure Graph 2 controls are visible (Graph 1 controls are no longer managed)
    this.graph2TransformControls.style.display = 'flex';

    this.graphContainer.style.display = "block";
    this.createDownloadButton(profile);
  }

  extractBrightnessProfile() {
    const prof = [];
    for (let x = 0; x < this.canvas.width; x++) {
      prof.push({
        x: Math.round((x * this.image.width) / this.canvas.width),
        brightness: this.getBrightness(x, this.probeLineY),
      });
    }
    return prof;
  }

  // drawGraph() REMOVED


  drawGraph2(data) {
    this.graphSvg.selectAll("*").remove();
    const W = this.svgWidth, H = this.svgHeight;
    const P = 60, extraTop = 20;
    const topPadding = P + extraTop, bottomPadding = P, leftPadding = P, rightPadding = P;
    const [minB, maxB] = d3.extent(data, d => d.brightness);

    const yScale = d3.scaleLinear().domain([minB, maxB]).range([H - bottomPadding, topPadding]);
    const xScale = d3.scaleLinear().domain([0, this.image.width]).range([leftPadding, W - rightPadding]);

    this.graphBounds = {
      leftPadding, rightPadding, topPadding, bottomPadding,
      plotWidth: W - leftPadding - rightPadding,
      plotHeight: H - bottomPadding - topPadding,
      xScale, yScale, width: W, height: H,
    };

    this.graphSvg.append("g").attr("class", "y-axis").attr("transform", `translate(${leftPadding}, 0)`).call(d3.axisLeft(yScale));
    this.xAxisContainer = this.graphSvg.append("g").attr("class", "x-axis-container");
    this.drawG2XAxis(); // Use custom axis drawing function

    // Y-axis label
    this.graphSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", (leftPadding / 2)-20) // Adjusted for better positioning
        .attr("x", -(H / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Helligkeit");

    // Initial X-axis label
    this.graphSvg.append("text")
        .attr("class", "x-axis-label")
        .attr("transform", `translate(${W / 2}, ${H / 2})`)
        .style("text-anchor", "middle")
        .text("");

    const lineGenerator = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.brightness));

    this.graphSvg.append("path").datum(data)
      .attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", 2)
      .attr("d", lineGenerator);

    this.updateMarkers();
  }


  drawG2XAxis() {
    const { bottomPadding, height: H, xScale, leftPadding, width: W, rightPadding } = this.graphBounds;
    this.xAxisContainer.selectAll("*").remove();

    this.xAxisContainer.append("line")
      .attr("x1", leftPadding).attr("y1", H - bottomPadding)
      .attr("x2", W - rightPadding).attr("y2", H - bottomPadding)
      .attr("stroke", "black");

    const tickLength = 6, labelOffset = 14;
    const ticks = xScale.ticks();
    
    for (const t of ticks) {
      const xPos = xScale(t);
      const labelValue = (t * this.g2AppliedScale) + this.g2AppliedShift;

      this.xAxisContainer.append("line")
        .attr("x1", xPos).attr("y1", H - bottomPadding)
        .attr("x2", xPos).attr("y2", H - bottomPadding + tickLength)
        .attr("stroke", "black");

      this.xAxisContainer.append("text")
        .attr("x", xPos).attr("y", H - bottomPadding + tickLength + labelOffset)
        .attr("text-anchor", "middle").attr("font-size", "12px")
        .text(labelValue.toFixed(2));
    }

    // Add X-axis label for Graph 2
    this.updateXAxisLabel("Pixel");
  }

    updateXAxisLabel(text) {
    // Remove previous label if it exists
    this.graphSvg.selectAll(".x-axis-label").remove();
    const { bottomPadding, height: H, width: W } = this.graphBounds;

    // Add new label
    this.graphSvg.append("text")
      .attr("class", "x-axis-label")
      .attr("transform", `translate(${W / 2}, ${(H - bottomPadding / 2) + 10})`)
      .style("text-anchor", "middle")
      .text(text);
  }


  applyG2Transform() {
    if (!this.graphBounds) return;
    const shift = Number(this.g2XShiftInput.value);
    const scale = Number(this.g2XScaleInput.value);
    
    if (isNaN(shift) || isNaN(scale)) {
        console.error("Invalid shift or scale value."); // todo: this should be a modal for the user
        return;
    }
    this.g2AppliedShift = shift;
    this.g2AppliedScale = scale;
    this.graphMarkers = [];
    this.updateMarkers();
    this.drawG2XAxis();
    this.updateXAxisLabel("Photonenenergie in eV");
  }

  // ================================================
  //            D3 GRAPH MOUSE INTERACTIONS
  // ================================================
  handleGraphMouseMove(event) {
    if (!this.graphData || !this.graphBounds) return;
    const { left } = this.svgNode.getBoundingClientRect();
    const mouseX = event.clientX - left;
    const { leftPadding, rightPadding, topPadding, bottomPadding, xScale } = this.graphBounds;

    if (mouseX < leftPadding || mouseX > this.svgWidth - rightPadding || event.offsetY < topPadding || event.offsetY > this.svgHeight - bottomPadding) {
      return this.hideTooltip();
    }
    
    // Convert mouse position to a coordinate in the data's native space (pixels)
    // SIMPLIFIED: Only using Pixel/Graph 2 logic
    const invertedX = xScale.invert(mouseX);
    let pixelX = invertedX;

    // Find the closest point in the data array
    const bisect = d3.bisector(d => d.x).left;
    const index = bisect(this.graphData, pixelX, 1);
    const p0 = this.graphData[index - 1];
    const p1 = this.graphData[index];
    const pt = (p1 && (pixelX - p0.x > p1.x - pixelX)) ? p1 : p0;
    
    if (pt) {
        this.showTooltip(event.clientX, event.clientY, `B:${pt.brightness}`);
    } else {
        this.hideTooltip();
    }
  }

  handleGraphClick(event) {
    if (!this.graphData || !this.graphBounds) return;
    const { left } = this.svgNode.getBoundingClientRect();
    const mouseX = event.clientX - left;
    const { leftPadding, rightPadding, topPadding, bottomPadding, xScale, yScale } = this.graphBounds;

    if (mouseX < leftPadding || mouseX > this.svgWidth - rightPadding || event.offsetY < topPadding || event.offsetY > this.svgHeight - bottomPadding) {
        return;
    }

    // --- STEP 1: Find the data point closest to the click ---
    
    // SIMPLIFIED: Only using Pixel/Graph 2 logic
    const invertedX = xScale.invert(mouseX);
    let pixelX = invertedX;

    // Find the closest point in the data array to where the user clicked
    const bisect = d3.bisector(d => d.x).left;
    const index = bisect(this.graphData, pixelX, 1);
    const p0 = this.graphData[index - 1];
    const p1 = this.graphData[index];
    const pt_closest = (p1 && (pixelX - p0.x > p1.x - pixelX)) ? p1 : p0;

    if (!pt_closest) return;

    // --- STEP 2: Find the highest peak within the search radius ---
    
    // Define the search area in data-space (image pixels)
    const searchMinX = pt_closest.x - this.peakSearchRadius;
    const searchMaxX = pt_closest.x + this.peakSearchRadius;

    // Filter the data to get all points within this area
    const areaData = this.graphData.filter(d => d.x >= searchMinX && d.x <= searchMaxX);

    // Find the point with the maximum brightness (the peak) in this area
    let pt_peak = pt_closest; // Default to the clicked point
    if (areaData.length > 0) {
        // Find the data point object with the highest brightness
        pt_peak = areaData.reduce((max, p) => (p.brightness > max.brightness ? p : max), areaData[0]);
    }

    // --- STEP 3: Place the marker at the found peak (pt_peak) ---

    let labelX, visualXForMarker;

    // SIMPLIFIED: Only using Pixel/Graph 2 logic
    labelX = (pt_peak.x * this.g2AppliedScale) + this.g2AppliedShift;
    visualXForMarker = pt_peak.x;

    this.graphMarkers.push({
      brightness: pt_peak.brightness, // Use pt_peak
      cx: xScale(visualXForMarker),
      cy: yScale(pt_peak.brightness), // Use pt_peak
      labelX: labelX,
    });
    this.updateMarkers();
  }

    deleteLastMarker() {
    if (this.graphMarkers.length > 0) {
      this.graphMarkers.pop();
      this.updateMarkers();
    }
  }

  updateMarkers() {
    this.graphSvg.selectAll(".marker-group").remove();
    const markerGroups = this.graphSvg.selectAll(".marker-group").data(this.graphMarkers).enter()
      .append("g").attr("class", "marker-group")
      .attr("transform", d => `translate(${d.cx}, ${d.cy})`);

    markerGroups.append("circle").attr("r", 5).attr("fill", "red");
    markerGroups.append("text")
      .attr("x", 8).attr("y", -8) // todo: this snapping area should be customizable by the user (at least add a checkbox to disable snapping)
      .attr("font-size", "12px").attr("fill", "black")
      .text(d => `X: ${d.labelX.toFixed(2)}`); 
  }

  hideGraph() {
    this.graphContainer.style.display = "none";
    this.graphMarkers = [];
    this.graphData = null;
    this.graphSvg.selectAll("*").remove();
    this.graphBounds = null;

    const oldCSV = document.getElementById("downloadCSVBtn");
    if (oldCSV) oldCSV.remove();
    const oldImgBtn = document.getElementById("saveImageBtn");
    if (oldImgBtn) oldImgBtn.remove();

    // Hide and reset all transform controls
    this.graph2TransformControls.style.display = 'none';
    this.g2AppliedShift = 0;
    this.g2AppliedScale = 1.0;
  }

  // ================================================
  //            CSV EXPORT & IMAGE SAVE
  // ================================================
  createDownloadButton(data) {
    const oldCSV = document.getElementById("downloadCSVBtn");
    if (oldCSV) oldCSV.remove();
    const oldImgBtn = document.getElementById("saveImageBtn");
    if (oldImgBtn) oldImgBtn.remove();

    const csvBtn = document.createElement("button");
    csvBtn.id = "downloadCSVBtn";
    csvBtn.textContent = "Messdaten als CSV exportieren";
    csvBtn.className = "btn-secondary";
    csvBtn.style.marginTop = "8px";
    csvBtn.addEventListener("click", () => this.downloadCSV(data));
    document.getElementById("graphContainer").appendChild(csvBtn);

    const imgBtn = document.createElement("button");
    imgBtn.id = "saveImageBtn";
    imgBtn.className = "btn-secondary";
    imgBtn.textContent = "Graph als Bild exportieren";
    imgBtn.style.marginLeft = "8px";
    imgBtn.addEventListener("click", () => this.savePlotAsPNG());
    document.getElementById("graphContainer").appendChild(imgBtn);
  }

  downloadCSV(data) {
    let csv = "x,brightness\n" + data.map((d) => `${d.x},${d.brightness}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "intensity_profile.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  savePlotAsPNG() {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(this.svgNode);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const targetWidth = 1400; // todo: make this customizable
      const targetHeight = targetWidth * (img.height / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "density_plot.png";
        link.click();
        URL.revokeObjectURL(link.href);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ================================================
  //            LAMBDA & ENERGY CONVERTER
  // ================================================

 lambdaConverter() {
        // 1. Store input in variable named lambdaConvInputValue
        let lambdaConvInputValue = parseFloat(this.lambdaInput.value);

        // Check if input is valid
        if (!isNaN(lambdaConvInputValue) && lambdaConvInputValue !== 0) {
            
            // 2. Process the calculation: 1243.1 / input
            const result = 1243.1 / lambdaConvInputValue;

            // 3. Display the result (Formatted to 4 decimal places)
            this.lambdaOutput.innerHTML = `E = ${result.toFixed(4)} eV`;
            
        } else {
            this.lambdaOutput.textContent = "Bitte gültigen Wert eingeben.";
        }
  }

  energyConverter() {
      // 1. Store input in variable named lambdaConvInputValue
      let energyConvInputValue = parseFloat(this.energyInput.value);

      // Check if input is valid
      if (!isNaN(energyConvInputValue) && energyConvInputValue !== 0) {
          
          // 2. Process the calculation: 1243.1 / input
          const result = 1243.1 / energyConvInputValue;

          // 3. Display the result (Formatted to 4 decimal places)               
          this.energyOutput.innerHTML = `&lambda; = ${result.toFixed(4)} nm`;
          
      } else {
          this.energyOutput.textContent = "Bitte gültigen Wert eingeben.";
      }
  }

  // ================================================
  //               RESET FUNCTIONALITY
  // ================================================
  reset() {
    this.probeLineY = null;
    this.isPlacingProbe = false;
    this.measurements = [];
    this.measurementCounter = 0;
    document.getElementById("selectMode").checked = false;
    this.selectMode = false;
    this.redrawOverlays();
    this.updateCoordinatesOutput();
    this.hideGraph();
    this.probeLineBtn.textContent = "Messlinie setzen";
  }

  // ================================================
  //                 TOOLTIP HELPERS
  // ================================================
  showTooltip(clientX, clientY, text) {
    this.tooltip.style.left = clientX + 10 + "px";
    this.tooltip.style.top = clientY + 10 + "px";
    this.tooltip.textContent = text;
    this.tooltip.style.display = "block";
  }

  hideTooltip() {
    this.tooltip.style.display = "none";
  }
}

// Initialize the app
const app = new ImageAnalysisTool();
