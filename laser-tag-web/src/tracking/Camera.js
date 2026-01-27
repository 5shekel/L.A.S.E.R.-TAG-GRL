/**
 * Camera module - handles webcam access via WebRTC
 */
export class Camera {
  constructor() {
    this.video = null;
    this.stream = null;
    this.isReady = false;
    this.width = 640;
    this.height = 480;
    this.mirror = false;  // Set true to flip horizontally
  }

  /**
   * Initialize camera with specified constraints
   * @param {HTMLVideoElement} videoElement - Video element to attach stream to
   * @param {Object} options - Camera options
   * @returns {Promise<void>}
   */
  async init(videoElement, options = {}) {
    this.video = videoElement;

    // Check for secure context (HTTPS required for camera access)
    if (!window.isSecureContext) {
      throw new Error('Camera access requires HTTPS. Please use https:// or localhost');
    }

    // Check for mediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not available. Please use a modern browser with HTTPS');
    }

    const constraints = {
      video: {
        width: { ideal: options.width || 640 },
        height: { ideal: options.height || 480 },
        facingMode: options.facingMode || 'environment',
        frameRate: { ideal: options.frameRate || 30 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.video.play()
            .then(resolve)
            .catch(reject);
        };
        this.video.onerror = reject;
      });

      // Get actual dimensions
      this.width = this.video.videoWidth;
      this.height = this.video.videoHeight;
      this.isReady = true;

      console.log(`Camera initialized: ${this.width}x${this.height}`);
    } catch (error) {
      console.error('Camera initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get list of available cameras
   * @returns {Promise<MediaDeviceInfo[]>}
   */
  static async getAvailableCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  }

  /**
   * Switch to a different camera
   * @param {string} deviceId - Device ID to switch to
   */
  async switchCamera(deviceId) {
    if (this.stream) {
      this.stop();
    }

    const constraints = {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: this.width },
        height: { ideal: this.height }
      },
      audio: false
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    await this.video.play();

    this.width = this.video.videoWidth;
    this.height = this.video.videoHeight;
    this.isReady = true;
  }

  /**
   * Get current video frame as ImageData
   * @param {CanvasRenderingContext2D} ctx - Canvas context to use for capture
   * @returns {ImageData|null}
   */
  getFrame(ctx) {
    if (!this.isReady) return null;

    ctx.save();
    if (this.mirror) {
      // Flip horizontally for mirrored cameras
      ctx.translate(this.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, 0, 0, this.width, this.height);
    ctx.restore();

    return ctx.getImageData(0, 0, this.width, this.height);
  }

  /**
   * Toggle mirror mode
   * @param {boolean} enabled - Whether to mirror the camera
   */
  setMirror(enabled) {
    this.mirror = enabled;
  }

  /**
   * Stop camera stream
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.isReady = false;
    }
  }

  /**
   * Check if camera is available
   * @returns {boolean}
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
