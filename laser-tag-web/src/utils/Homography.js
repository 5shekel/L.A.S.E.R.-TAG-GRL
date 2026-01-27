/**
 * Homography - Perspective transformation utility
 * Computes and applies homography matrix for quad warping
 *
 * Based on the original guiQuad and imageProjection from C++ L.A.S.E.R. TAG
 */

export class Homography {
  /**
   * Compute 3x3 homography matrix from source to destination quad
   * Maps 4 source points to 4 destination points
   *
   * @param {Array} src - Source points [{x, y}, ...] (4 points)
   * @param {Array} dst - Destination points [{x, y}, ...] (4 points)
   * @returns {Array} 3x3 homography matrix as flat array [h00, h01, h02, h10, h11, h12, h20, h21, h22]
   */
  static computeHomography(src, dst) {
    // We need to solve: dst = H * src (in homogeneous coordinates)
    // For each point pair (x,y) -> (x',y'):
    // x' = (h00*x + h01*y + h02) / (h20*x + h21*y + h22)
    // y' = (h10*x + h11*y + h12) / (h20*x + h21*y + h22)
    //
    // Rearranging to linear form (with h22 = 1 for normalization):
    // h00*x + h01*y + h02 - h20*x*x' - h21*y*x' = x'
    // h10*x + h11*y + h12 - h20*x*y' - h21*y*y' = y'

    // Build 8x8 matrix A and 8x1 vector b for least squares
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
      const x = src[i].x;
      const y = src[i].y;
      const xp = dst[i].x;
      const yp = dst[i].y;

      // First equation: for x'
      A.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp]);
      b.push(xp);

      // Second equation: for y'
      A.push([0, 0, 0, x, y, 1, -x * yp, -y * yp]);
      b.push(yp);
    }

    // Solve using Gaussian elimination with partial pivoting
    const h = this.solveLinearSystem(A, b);

    if (!h) {
      // Return identity if solve fails
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    // Return 3x3 matrix (h22 = 1)
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  /**
   * Solve linear system Ax = b using Gaussian elimination
   * @param {Array} A - 8x8 matrix
   * @param {Array} b - 8x1 vector
   * @returns {Array} Solution vector x
   */
  static solveLinearSystem(A, b) {
    const n = 8;

    // Create augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxVal = Math.abs(aug[col][col]);
      let maxRow = col;

      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > maxVal) {
          maxVal = Math.abs(aug[row][col]);
          maxRow = row;
        }
      }

      // Swap rows
      if (maxRow !== col) {
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      }

      // Check for singularity
      if (Math.abs(aug[col][col]) < 1e-10) {
        return null;
      }

      // Eliminate column
      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i];
    }

    return x;
  }

  /**
   * Convert 3x3 homography to CSS matrix3d format
   * CSS matrix3d uses column-major 4x4 matrix
   *
   * @param {Array} H - 3x3 homography [h00, h01, h02, h10, h11, h12, h20, h21, h22]
   * @param {number} width - Element width
   * @param {number} height - Element height
   * @returns {string} CSS matrix3d() string
   */
  static toMatrix3d(H, width, height) {
    // The 3x3 homography operates on normalized coordinates
    // We need to convert to a 4x4 matrix that CSS can use
    //
    // The conversion requires accounting for:
    // 1. CSS transform origin (center by default, we use top-left)
    // 2. Pixel coordinates vs normalized

    const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = H;

    // Build 4x4 matrix for 2D homography in 3D space
    // We embed the 2D homography in the x-y plane (z=0)
    //
    // The 4x4 matrix in column-major order for CSS:
    // [a, b, 0, p]   [m11, m21, m31, m41]
    // [c, d, 0, q] = [m12, m22, m32, m42]
    // [0, 0, 1, 0]   [m13, m23, m33, m43]
    // [e, f, 0, s]   [m14, m24, m34, m44]

    // For CSS matrix3d(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p)
    // The matrix is:
    // | a  e  i  m |
    // | b  f  j  n |
    // | c  g  k  o |
    // | d  h  l  p |

    // Mapping from 3x3 homography to 4x4:
    // | h00  h01  0  h02 |
    // | h10  h11  0  h12 |
    // |  0    0   1   0  |
    // | h20  h21  0  h22 |

    return `matrix3d(${h00}, ${h10}, 0, ${h20}, ${h01}, ${h11}, 0, ${h21}, 0, 0, 1, 0, ${h02}, ${h12}, 0, ${h22})`;
  }

  /**
   * Apply homography to transform a single point
   * @param {Array} H - 3x3 homography matrix
   * @param {number} x - Input x
   * @param {number} y - Input y
   * @returns {{x: number, y: number}} Transformed point
   */
  static transformPoint(H, x, y) {
    const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = H;

    const w = h20 * x + h21 * y + h22;
    return {
      x: (h00 * x + h01 * y + h02) / w,
      y: (h10 * x + h11 * y + h12) / w
    };
  }

  /**
   * Compute inverse homography
   * @param {Array} H - 3x3 homography matrix
   * @returns {Array} Inverse 3x3 matrix
   */
  static inverse(H) {
    const [a, b, c, d, e, f, g, h, i] = H;

    // 3x3 matrix inverse
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

    if (Math.abs(det) < 1e-10) {
      return [1, 0, 0, 0, 1, 0, 0, 0, 1]; // Identity if singular
    }

    const invDet = 1 / det;

    return [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
      (d * h - e * g) * invDet,
      (b * g - a * h) * invDet,
      (a * e - b * d) * invDet
    ];
  }

  /**
   * Create homography for projection mapping
   * Maps from source rectangle to destination quad
   *
   * @param {number} srcWidth - Source width
   * @param {number} srcHeight - Source height
   * @param {Array} dstQuad - Destination quad corners (normalized 0-1) [{x, y}, ...]
   * @param {number} dstWidth - Destination width in pixels
   * @param {number} dstHeight - Destination height in pixels
   * @returns {Array} Homography matrix
   */
  static createProjectionMapping(srcWidth, srcHeight, dstQuad, dstWidth, dstHeight) {
    // Source: rectangle corners
    const src = [
      { x: 0, y: 0 },
      { x: srcWidth, y: 0 },
      { x: srcWidth, y: srcHeight },
      { x: 0, y: srcHeight }
    ];

    // Destination: scaled quad corners
    const dst = dstQuad.map(p => ({
      x: p.x * dstWidth,
      y: p.y * dstHeight
    }));

    return this.computeHomography(src, dst);
  }
}
