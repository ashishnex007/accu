import * as $ from './utilities.js';

//dalaoshe modification
import {CROP_BOX_TEMPLATE} from './template.js';
import {PREVIEW_IMG_TEMPLATE} from './template.js';

const NAMESPACE = 'cropper';
// Classes
const CLASS_HIDDEN = `${NAMESPACE}-hidden`;

// Events
//over

function getPointersCenter(pointers) {
  let pageX = 0;
  let pageY = 0;
  let count = 0;

  $.each(pointers, ({ startX, startY }) => {
    pageX += startX;
    pageY += startY;
    count += 1;
  });

  pageX /= count;
  pageY /= count;

  return {
    pageX,
    pageY,
  };
}

export default {
  // Show the crop box manually
  crop() {
    const self = this;

    if (self.ready && !self.disabled) {
      if (!self.cropped) {
        self.cropped = true;
        self.limitCropBox(true, true);

        if (self.options.modal) {
          $.addClass(self.dragBox, 'cropper-modal');
        }

        $.removeClass(self.cropBox, 'cropper-hidden');
      }

      self.setCropBoxData(self.initialCropBoxData);
	}

    return self;
  },

  // Reset the image and crop box to their initial states
  reset() {
    const self = this;

    if (self.ready && !self.disabled) {
      self.imageData = $.extend({}, self.initialImageData);
      self.canvasData = $.extend({}, self.initialCanvasData);
      self.cropBoxData = $.extend({}, self.initialCropBoxData);

      self.renderCanvas();

      if (self.cropped) {
        self.renderCropBox();
      }
    }

    return self;
  },

  // Clear the crop box
  clear() {
    const self = this;

    if (self.cropped && !self.disabled) {
      $.extend(self.cropBoxData, {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      });

      self.cropped = false;
      self.renderCropBox();

      self.limitCanvas();

      // Render canvas after crop box rendered
      self.renderCanvas();

      $.removeClass(self.dragBox, 'cropper-modal');
      $.addClass(self.cropBox, 'cropper-hidden');
    }

    return self;
  },

  /**
   * Replace the image's src and rebuild the cropper
   *
   * @param {String} url
   * @param {Boolean} onlyColorChanged (optional)
   */
  replace(url, onlyColorChanged) {
    const self = this;

    if (!self.disabled && url) {
      if (self.isImg) {
        self.element.src = url;
      }

      if (onlyColorChanged) {
        self.url = url;
        self.image.src = url;

        if (self.ready) {
          self.image2.src = url;

          $.each(self.previews, (element) => {
            $.getByTag(element, 'img')[0].src = url;
          });
        }
      } else {
        if (self.isImg) {
          self.replaced = true;
        }

        // Clear previous data
        self.options.data = null;
        self.unbuild();
		self.loaded = false;
		self.load(url);
      }
    }

    return self;
  },

  // Enable (unfreeze) the cropper
  enable() {
    const self = this;

    if (self.ready) {
      self.disabled = false;
      $.removeClass(self.cropper, 'cropper-disabled');
    }

    return self;
  },

  // Disable (freeze) the cropper
  disable() {
    const self = this;

    if (self.ready) {
      self.disabled = true;
      $.addClass(self.cropper, 'cropper-disabled');
    }

    return self;
  },

  // Destroy the cropper and remove the instance from the image
  destroy() {
    const self = this;
    const element = self.element;
    const image = self.image;

    if (self.loaded) {
      if (self.isImg && self.replaced) {
        element.src = self.originalUrl;
      }

      self.unbuild();
      $.removeClass(element, 'cropper-hidden');
    } else if (self.isImg) {
      $.removeListener(element, 'load', self.onStart);
    } else if (image) {
      $.removeChild(image);
    }

    $.removeData(element, 'cropper');

    return self;
  },

  /**
   * Move the canvas with relative offsets
   *
   * @param {Number} offsetX
   * @param {Number} offsetY (optional)
   */
  move(offsetX, offsetY) {
    const self = this;
    const canvasData = self.canvasData;

    return self.moveTo(
      $.isUndefined(offsetX) ? offsetX : (canvasData.left + Number(offsetX)),
      $.isUndefined(offsetY) ? offsetY : (canvasData.top + Number(offsetY))
    );
  },

  /**
   * Move the canvas to an absolute point
   *
   * @param {Number} x
   * @param {Number} y (optional)
   */
  moveTo(x, y) {
    const self = this;
    const canvasData = self.canvasData;
    let changed = false;

    // If "y" is not present, its default value is "x"
    if ($.isUndefined(y)) {
      y = x;
    }

    x = Number(x);
    y = Number(y);

    if (self.ready && !self.disabled && self.options.movable) {
      if ($.isNumber(x)) {
        canvasData.left = x;
        changed = true;
      }

      if ($.isNumber(y)) {
        canvasData.top = y;
        changed = true;
      }

      if (changed) {
        self.renderCanvas(true);
      }
    }

    return self;
  },

  /**
   * Zoom the canvas with a relative ratio
   *
   * @param {Number} ratio
   * @param {Event} _originalEvent (private)
   */
  zoom(ratio, _originalEvent) {
    const self = this;
    const canvasData = self.canvasData;

    ratio = Number(ratio);

    if (ratio < 0) {
      ratio = 1 / (1 - ratio);
    } else {
      ratio = 1 + ratio;
    }

    return self.zoomTo((canvasData.width * ratio) / canvasData.naturalWidth, _originalEvent);
  },

  /**
   * Zoom the canvas to an absolute ratio
   *
   * @param {Number} ratio
   * @param {Event} _originalEvent (private)
   */
  zoomTo(ratio, _originalEvent) {
    const self = this;
    const options = self.options;
    const canvasData = self.canvasData;
    const width = canvasData.width;
    const height = canvasData.height;
    const naturalWidth = canvasData.naturalWidth;
    const naturalHeight = canvasData.naturalHeight;

    ratio = Number(ratio);

    if (ratio >= 0 && self.ready && !self.disabled && options.zoomable) {
      const newWidth = naturalWidth * ratio;
      const newHeight = naturalHeight * ratio;

      if ($.dispatchEvent(self.element, 'zoom', {
        originalEvent: _originalEvent,
        oldRatio: width / naturalWidth,
        ratio: newWidth / naturalWidth,
      }) === false) {
        return self;
      }

      if (_originalEvent) {
        const pointers = self.pointers;
        const offset = $.getOffset(self.cropper);
        const center = pointers && Object.keys(pointers).length ? getPointersCenter(pointers) : {
          pageX: _originalEvent.pageX,
          pageY: _originalEvent.pageY,
        };

        // Zoom from the triggering point of the event
        canvasData.left -= (newWidth - width) * (
          ((center.pageX - offset.left) - canvasData.left) / width
        );
        canvasData.top -= (newHeight - height) * (
          ((center.pageY - offset.top) - canvasData.top) / height
        );
      } else {
        // Zoom from the center of the canvas
        canvasData.left -= (newWidth - width) / 2;
        canvasData.top -= (newHeight - height) / 2;
      }

      canvasData.width = newWidth;
      canvasData.height = newHeight;
      self.renderCanvas(true);
    }

    return self;
  },

  /**
   * Rotate the canvas with a relative degree
   *
   * @param {Number} degree
   */
  rotate(degree) {
    const self = this;

    return self.rotateTo((self.imageData.rotate || 0) + Number(degree));
  },

  /**
   * Rotate the canvas to an absolute degree
   * https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function#rotate()
   *
   * @param {Number} degree
   */
  rotateTo(degree) {
    const self = this;

    degree = Number(degree);

    if ($.isNumber(degree) && self.ready && !self.disabled && self.options.rotatable) {
      self.imageData.rotate = degree % 360;
      self.rotated = true;
      self.renderCanvas(true);
    }

    return self;
  },

  /**
   * Scale the image
   * https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function#scale()
   *
   * @param {Number} scaleX
   * @param {Number} scaleY (optional)
   */
  scale(scaleX, scaleY) {
    const self = this;
    const imageData = self.imageData;
    let changed = false;

    // If "scaleY" is not present, its default value is "scaleX"
    if ($.isUndefined(scaleY)) {
      scaleY = scaleX;
    }

    scaleX = Number(scaleX);
    scaleY = Number(scaleY);

    if (self.ready && !self.disabled && self.options.scalable) {
      if ($.isNumber(scaleX)) {
        imageData.scaleX = scaleX;
        changed = true;
      }

      if ($.isNumber(scaleY)) {
        imageData.scaleY = scaleY;
        changed = true;
      }

      if (changed) {
        self.renderImage(true);
      }
    }

    return self;
  },

  /**
   * Scale the abscissa of the image
   *
   * @param {Number} scaleX
   */
  scaleX(scaleX) {
    const self = this;
    const scaleY = self.imageData.scaleY;

    return self.scale(scaleX, $.isNumber(scaleY) ? scaleY : 1);
  },

  /**
   * Scale the ordinate of the image
   *
   * @param {Number} scaleY
   */
  scaleY(scaleY) {
    const self = this;
    const scaleX = self.imageData.scaleX;

    return self.scale($.isNumber(scaleX) ? scaleX : 1, scaleY);
  },

  /**
   * Get the cropped area position and size data (base on the original image)
   *
   * @param {Boolean} rounded (optional)
   * @return {Object} data
   */
  getData(rounded) {
    const self = this;
    const options = self.options;
    const imageData = self.imageData;
    const canvasData = self.canvasData;
    const cropBoxData = self.cropBoxData;
    let ratio;
    let data;

    if (self.ready && self.cropped) {
      data = {
        x: cropBoxData.left - canvasData.left,
        y: cropBoxData.top - canvasData.top,
        width: cropBoxData.width,
        height: cropBoxData.height,
      };

      ratio = imageData.width / imageData.naturalWidth;

      $.each(data, (n, i) => {
        n /= ratio;
        data[i] = rounded ? Math.round(n) : n;
      });
    } else {
      data = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
    }

    if (options.rotatable) {
      data.rotate = imageData.rotate || 0;
    }

    if (options.scalable) {
      data.scaleX = imageData.scaleX || 1;
      data.scaleY = imageData.scaleY || 1;
    }

    return data;
  },

  /**
   * Set the cropped area position and size with new data
   *
   * @param {Object} data
   */
  setData(data) {
    const self = this;
    const options = self.options;
    const imageData = self.imageData;
    const canvasData = self.canvasData;
    const cropBoxData = {};
    let rotated;
    let scaled;
    let ratio;

    if ($.isFunction(data)) {
      data = data.call(self.element);
    }

    if (self.ready && !self.disabled && $.isPlainObject(data)) {
	  if (options.rotatable) {
        if ($.isNumber(data.rotate) && data.rotate !== imageData.rotate) {
          imageData.rotate = data.rotate;
          self.rotated = rotated = true;
        }
      }

      if (options.scalable) {
        if ($.isNumber(data.scaleX) && data.scaleX !== imageData.scaleX) {
          imageData.scaleX = data.scaleX;
          scaled = true;
        }

        if ($.isNumber(data.scaleY) && data.scaleY !== imageData.scaleY) {
          imageData.scaleY = data.scaleY;
          scaled = true;
        }
      }

      if (rotated) {
        self.renderCanvas();
      } else if (scaled) {
        self.renderImage();
      }

      ratio = imageData.width / imageData.naturalWidth;

      if ($.isNumber(data.x)) {
        cropBoxData.left = (data.x * ratio) + canvasData.left;
      }

      if ($.isNumber(data.y)) {
        cropBoxData.top = (data.y * ratio) + canvasData.top;
      }

      if ($.isNumber(data.width)) {
        cropBoxData.width = data.width * ratio;
      }

      if ($.isNumber(data.height)) {
        cropBoxData.height = data.height * ratio;
      }
      self.setCropBoxData(cropBoxData);
    }
    return self;
  },

  /**
   * Get the container size data
   *
   * @return {Object} data
   */
  getContainerData() {
    const self = this;

    return self.ready ? self.containerData : {};
  },

  /**
   * Get the image position and size data
   *
   * @return {Object} data
   */
  getImageData() {
    const self = this;

    return self.loaded ? self.imageData : {};
  },

  /**
   * Get the canvas position and size data
   *
   * @return {Object} data
   */
  getCanvasData() {
    const self = this;
    const canvasData = self.canvasData;
    const data = {};

    if (self.ready) {
      $.each([
        'left',
        'top',
        'width',
        'height',
        'naturalWidth',
        'naturalHeight',
      ], (n) => {
        data[n] = canvasData[n];
      });
    }

    return data;
  },

  /**
   * Set the canvas position and size with new data
   *
   * @param {Object} data
   */
  setCanvasData(data) {
    const self = this;
    const canvasData = self.canvasData;
    const aspectRatio = canvasData.aspectRatio;

    if ($.isFunction(data)) {
      data = data.call(self.element);
    }

    if (self.ready && !self.disabled && $.isPlainObject(data)) {
      if ($.isNumber(data.left)) {
        canvasData.left = data.left;
      }

      if ($.isNumber(data.top)) {
        canvasData.top = data.top;
      }

      if ($.isNumber(data.width)) {
        canvasData.width = data.width;
        canvasData.height = data.width / aspectRatio;
      } else if ($.isNumber(data.height)) {
        canvasData.height = data.height;
        canvasData.width = data.height * aspectRatio;
      }

      self.renderCanvas(true);
    }

    return self;
  },

  /**
   * Get the crop box position and size data
   *
   * @return {Object} data
   */
  getCropBoxData() {
    const self = this;
    const cropBoxData = self.cropBoxData;
    let data;

    if (self.ready && self.cropped) {
      data = {
        left: cropBoxData.left,
        top: cropBoxData.top,
        width: cropBoxData.width,
        height: cropBoxData.height,
      };
    }

    return data || {};
  },

  /**
   * Set the crop box position and size with new data
   *
   * @param {Object} data
   */
  setCropBoxData(data) {
    const self = this;
    const cropBoxData = self.cropBoxData;
    const aspectRatio = self.options.aspectRatio;
    let widthChanged;
    let heightChanged;

    if ($.isFunction(data)) {
      data = data.call(self.element);
    }

    if (self.ready && self.cropped && !self.disabled && $.isPlainObject(data)) {
      if ($.isNumber(data.left)) {
        cropBoxData.left = data.left;
      }

      if ($.isNumber(data.top)) {
        cropBoxData.top = data.top;
      }

      if ($.isNumber(data.width) && data.width !== cropBoxData.width) {
        widthChanged = true;
        cropBoxData.width = data.width;
      }

      if ($.isNumber(data.height) && data.height !== cropBoxData.height) {
        heightChanged = true;
        cropBoxData.height = data.height;
      }

      if (aspectRatio) {
        if (widthChanged) {
          cropBoxData.height = cropBoxData.width / aspectRatio;
        } else if (heightChanged) {
          cropBoxData.width = cropBoxData.height * aspectRatio;
        }
      }
	  //console.log("did set cropBox data"); // culprit for one sec
      self.renderCropBox();
    }

    return self;
  },

  /**
   * Get a canvas drawn the cropped image
   *
   * @param {Object} options (optional)
   * @return {HTMLCanvasElement} canvas
   */
  getCroppedCanvas(options) {
    const self = this;

    if (!self.ready || !window.HTMLCanvasElement) {
      return null;
    }

    if (!$.isPlainObject(options)) {
      options = {};
    }

    // Return the whole canvas if not cropped
    if (!self.cropped) {
      return $.getSourceCanvas(self.image, self.imageData, options);
    }

    const data = self.getData();
    const originalWidth = data.width;
    const originalHeight = data.height;
    const aspectRatio = originalWidth / originalHeight;
    let scaledWidth;
    let scaledHeight;
    let scaledRatio;

    if ($.isPlainObject(options)) {
      scaledWidth = options.width;
      scaledHeight = options.height;

      if (scaledWidth) {
        scaledHeight = scaledWidth / aspectRatio;
        scaledRatio = scaledWidth / originalWidth;
      } else if (scaledHeight) {
        scaledWidth = scaledHeight * aspectRatio;
        scaledRatio = scaledHeight / originalHeight;
      }
    }

    // The canvas element will use `Math.floor` on a float number, so floor first
    const canvasWidth = Math.floor(scaledWidth || originalWidth);
    const canvasHeight = Math.floor(scaledHeight || originalHeight);

    const canvas = $.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    if (options.fillColor) {
      context.fillStyle = options.fillColor;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D.drawImage
    const parameters = (() => {
      const source = $.getSourceCanvas(self.image, self.imageData, options);
      const sourceWidth = source.width;
      const sourceHeight = source.height;
      const canvasData = self.canvasData;
      const params = [source];

      // Source canvas
      let srcX = data.x + ((canvasData.naturalWidth * (Math.abs(data.scaleX || 1) - 1)) / 2);
      let srcY = data.y + ((canvasData.naturalHeight * (Math.abs(data.scaleY || 1) - 1)) / 2);
      let srcWidth;
      let srcHeight;

      // Destination canvas
      let dstX;
      let dstY;
      let dstWidth;
      let dstHeight;

      if (srcX <= -originalWidth || srcX > sourceWidth) {
        srcX = srcWidth = dstX = dstWidth = 0;
      } else if (srcX <= 0) {
        dstX = -srcX;
        srcX = 0;
        srcWidth = dstWidth = Math.min(sourceWidth, originalWidth + srcX);
      } else if (srcX <= sourceWidth) {
        dstX = 0;
        srcWidth = dstWidth = Math.min(originalWidth, sourceWidth - srcX);
      }

      if (srcWidth <= 0 || srcY <= -originalHeight || srcY > sourceHeight) {
        srcY = srcHeight = dstY = dstHeight = 0;
      } else if (srcY <= 0) {
        dstY = -srcY;
        srcY = 0;
        srcHeight = dstHeight = Math.min(sourceHeight, originalHeight + srcY);
      } else if (srcY <= sourceHeight) {
        dstY = 0;
        srcHeight = dstHeight = Math.min(originalHeight, sourceHeight - srcY);
      }

      params.push(Math.floor(srcX), Math.floor(srcY), Math.floor(srcWidth), Math.floor(srcHeight));

      // Scale destination sizes
      if (scaledRatio) {
        dstX *= scaledRatio;
        dstY *= scaledRatio;
        dstWidth *= scaledRatio;
        dstHeight *= scaledRatio;
      }

      // Avoid "IndexSizeError" in IE and Firefox
      if (dstWidth > 0 && dstHeight > 0) {
        params.push(
          Math.floor(dstX),
          Math.floor(dstY),
          Math.floor(dstWidth),
          Math.floor(dstHeight)
        );
      }

      return params;
    })();

    context.imageSmoothingEnabled = !!options.imageSmoothingEnabled;

    if (options.imageSmoothingQuality) {
      context.imageSmoothingQuality = options.imageSmoothingQuality;
    }

    context.drawImage(...parameters);

    return canvas;
  },

  /**
   * Change the aspect ratio of the crop box
   *
   * @param {Number} aspectRatio
   */
  setAspectRatio(aspectRatio) {
    const self = this;
    const options = self.options;

    if (!self.disabled && !$.isUndefined(aspectRatio)) {
      // 0 -> NaN
      options.aspectRatio = Math.max(0, aspectRatio) || NaN;

      if (self.ready) {
        self.initCropBox();

        if (self.cropped) {
          self.renderCropBox();
        }
      }
    }

    return self;
  },

  /**
   * Change the drag mode
   *
   * @param {String} mode (optional)
   */
  setDragMode(mode) {
    const self = this;
    const options = self.options;
    const dragBox = self.dragBox;
    const face = self.face;
    let croppable;
    let movable;

    if (self.loaded && !self.disabled) {
      croppable = mode === 'crop';
      movable = options.movable && mode === 'move';
      mode = (croppable || movable) ? mode : 'none';

      $.setData(dragBox, 'action', mode);
      $.toggleClass(dragBox, 'cropper-crop', croppable);
      $.toggleClass(dragBox, 'cropper-move', movable);

      if (!options.cropBoxMovable) {
        // Sync drag mode to crop box when it is not movable
        $.setData(face, 'action', mode);
        $.toggleClass(face, 'cropper-crop', croppable);
        $.toggleClass(face, 'cropper-move', movable);
      }
    }

    return self;
  },

//dalaoshe modification
  activeCropperBox(cropper_id) {
	let self = this;
	self.nowCropBoxIndex = cropper_id;
	self.cropBox = self.cropBoxs[cropper_id];
	self.viewBox = self.viewBoxs[cropper_id];
	self.face = self.faces[cropper_id];
	self.image2 = self.previewCropBoxImages[cropper_id];	
	self.cropBoxData = self.cropBoxDatas[cropper_id];
	self.displayActiveCropperBox(cropper_id);
  },
//Todo change color!!
  freezeCropperBox(cropper_id) {
	let self = this;
	self.cropBoxStates[cropper_id] = 3; 
    $.addClass(self.previewCropBoxImages[cropper_id], 'cropper-hidden');
  },
  createNewCropperBox() {
	//console.log("Create New Cropper:" );
	let self = this;
	if(!self.cropped) self.cropped = true;
	//Create CropBox Dom
	const crop_box_template	= $.createElement('div');
	crop_box_template.innerHTML = CROP_BOX_TEMPLATE;	
	let createCropBoxIndex = self.nowCropBoxNum;
	let cropBox = $.getByClass(crop_box_template, 'cropper-crop-box')[0];
	let face = $.getByClass(cropBox, 'cropper-face')[0];
    let viewBox =  $.getByClass(cropBox, 'cropper-view-box')[0];
	//Init
	self.initNewCropBox(createCropBoxIndex, cropBox, viewBox, face);
	//Append to cropper
	$.appendChild(self.cropper, cropBox);	
	self.nowCropBoxNum += 1;
	self.activeCropperBox(self.nowCropBoxNum - 1);
	self.renderCropBox();
	if ($.dispatchEvent(self.cropper, 'newcropbox', {
    }) === false) {
      return;
    }
  },
  initNewCropBoxByOptions(index) {
	  const self = this;
	  let options = self.options;
	  let cropBox = self.cropBoxs[index];
	  let face = self.faces[index];
	  if (!options.autoCrop) {
		  $.addClass(cropBox, CLASS_HIDDEN);
	  }
	  if (!options.guides) {
		  $.addClass($.getByClass(cropBox, 'cropper-dashed'), CLASS_HIDDEN);
	  }
	  if (!options.center) {
		  $.addClass($.getByClass(cropBox, 'cropper-center'), CLASS_HIDDEN);
	  }
	  if (!options.cropBoxResizable) {
		 $.addClass($.getByClass(cropBox, 'cropper-line'), CLASS_HIDDEN);
		 $.addClass($.getByClass(cropBox, 'cropper-line'), CLASS_HIDDEN);
	  }
	  if (!options.highlight) {
		  $.addClass(face, 'cropper-invisivle');
	  }
	  if (options.cropBoxMovable) {
		$.addClass(face, 'cropper-move');
		$.setData(face, 'action', 'all');
	  }
  },
  initCropBoxChangeBindEvent(index) {
		let self = this;
		let cropBox = self.cropBoxs[index];
		let face =self.faces[index];
		cropBox.addEventListener('mousedown', self.cropBoxMouseDown, false);
		cropBox.addEventListener('dblclick', 
				(self.onCropBoxDblclick = $.proxy(self.cropBoxDblclick, self)),
				false);
		cropBox.addEventListener('cropreceive', 
				(self.onCropReceive = $.proxy(self.cropBoxReceiveClick, self)),
				false);

		let identifier = $.generateRandomIdentifier(12);
		cropBox.identifier = identifier;
		$.setData(face, 'cropperidentifier', identifier);
		$.setData(cropBox, 'cropperidentifier', identifier);
  },
  initNewCropBoxPreview(index, cropBox, viewBox, face) {
		let self = this;
		let image = $.createElement('img');
		let crossOrigin = self.crossOrigin;
		let url = crossOrigin ? self.crossOriginUrl : self.url;
		
		if (crossOrigin) {
			image.crossOrigin = crossOrigin;
		}
		image.src = url;
		$.appendChild(viewBox, image);
		let previews = self.previewBlocks;
		self.previewCropBoxImages[index] = image;
		self.createNewPreviewImaBlock(index);		
		self.initPreviewImage(previews[index], crossOrigin, url);
		self.hiddenCropperBox(index);
  },
  initNewCropBox(index, cropBox, viewBox, face) {
	const self = this;
	//Expand State Arrs
	//console.log(self.cropBoxs.length);
	self.cropBoxs[index] = cropBox;
	self.viewBoxs[index] = viewBox;
	self.faces[index] = face;
	self.cropBoxStates[index] = 1;
	let cropBoxData = $.extend({}, self.initialCropBoxData);
	cropBoxData.width = 0;
	cropBoxData.height = 0;
	self.cropBoxDatas[index] = cropBoxData;
	//Init Preview Box
	self.initNewCropBoxPreview(index, cropBox, viewBox, face);
	//Init By Options
	self.initNewCropBoxByOptions(index);
	//Init CropBoxData
	
	//Init CropBoxChangeEvent
	self.initCropBoxChangeBindEvent(index);
  },
  createNewPreviewImaBlock(index) {
	const self = this;
	const preview_template	= $.createElement('div');
	preview_template.innerHTML = PREVIEW_IMG_TEMPLATE;	
	let preview_item = $.getByClass(preview_template, 'img-preview-item')[0];
	self.previewBlocks[index] = preview_item;
  },
  displayActiveCropperBox(index) {
	let self = this;
	self.cropBoxStates[index] = 1;
	self.cropBoxs[index].removeAttribute('hidden');
	self.previewBlocks[index].removeAttribute('hidden');
	$.removeClass(self.cropBoxs[index], CLASS_HIDDEN);
    $.removeClass(self.previewCropBoxImages[index], 'cropper-hidden');
  },
  hiddenCropperBox(index) {
	  let self = this;
	  self.cropBoxStates[index] = 0;
	  self.cropBoxs[index].setAttribute('hidden', 'hidden');
	  self.previewBlocks[index].setAttribute('hidden', 'hidden');
      $.addClass(self.previewCropBoxImages[index], 'cropper-hidden');

  },
  getCropBoxIndexByIdentifier(identifier) {
	let self = this;
	let cropBoxs = self.cropBoxs;
	for(let i = 0; i < cropBoxs.length; ++i) {
		if(cropBoxs[i].identifier === identifier) {
			return i;
		}
	}
	return -1;
  },
  destroyCropBoxByIndex(index) {
	let self = this;
	if(self.nowCropBoxNum === 1 && index === 0){
	
	}
	else if(self.nowCropBoxIndex > index) {
		self.nowCropBoxIndex -= 1;
	}
	else if(self.nowCropBoxIndex === index) {
		self.freezeCropperBox(index);
		if(index !== 0) {
			self.activeCropperBox(index-1);
		}
		else {
			self.activeCropperBox(index+1);
			self.nowCropBoxIndex = 0;
		}
	}
	// destroy
	self.destroyCropBoxDomByIndex(index);
	self.cropBoxs.splice(index,1);
	self.viewBoxs.splice(index,1);
	self.faces.splice(index,1);
	self.cropBoxStates.splice(index,1);
	self.cropBoxDatas.splice(index,1);
	self.previewCropBoxImages.splice(index,1);
	self.previewBlocks.splice(index,1);
	self.nowCropBoxNum -= 1;
	
	if(self.nowCropBoxNum === 0) {
		self.nowCropBoxIndex = 0;
	}

	if ($.dispatchEvent(self.cropper, 'destroycropbox', {
		index,
    }) === false) {
      return;
    }
	//
  },
  destroyCropBoxDomByIndex(index) {
	  let self = this;
	  $.removeChild(self.cropBoxs[index]);
	  $.removeChild(self.previewBlocks[index]);
  },
  // 获取基于像素值的CropBoxData
  getAllCropBoxDatas() {
	const self = this;
	let datas = [];
	let total = self.nowCropBoxNum;
	for(let i = 0; i < total; ++i) {
		datas[i] = self.getCropBoxDataByIndex(i);
	}
	return datas;
  },
  getAllPreviewBlocks() {
	const self = this;
	let [ ...datas] = self.previewBlocks;
	return datas;
  },
  getCropBoxDataByIndex(index, rounded) {
    const self = this;
    const options = self.options;
    const imageData = self.imageData;
    const canvasData = self.canvasData;
    const cropBoxData = self.cropBoxDatas[index];
    let ratio;
    let data;

    if (self.ready && self.cropped) {
      data = {
        x: cropBoxData.left - canvasData.left,
        y: cropBoxData.top - canvasData.top,
        width: cropBoxData.width,
        height: cropBoxData.height,
      };

      ratio = imageData.width / imageData.naturalWidth;

      $.each(data, (n, i) => {
        n /= ratio;
        data[i] = rounded ? Math.round(n) : n;
      });
    } else {
      data = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
    }

    if (options.rotatable) {
      data.rotate = imageData.rotate || 0;
    }

    if (options.scalable) {
      data.scaleX = imageData.scaleX || 1;
      data.scaleY = imageData.scaleY || 1;
    }

    return data;
  },
//dalaoshe over

};
