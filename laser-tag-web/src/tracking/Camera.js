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
  }

  /**
   * Initialize camera with specified constraints
   * @param {HTMLVideoElement} videoElement - Video element to attach stream to
   * @param {Object} options - Camera options
   * @returns {Promise<void>}
   */
  async init(videoElement, options = {}) {
    this.video = videoElement;

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

    ctx.drawImage(this.video, 0, 0, this.width, this.height);
    return ctx.getImageData(0, 0, this.width, this.height);
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
