# DSP Algorithms & Mathematical Formulation Reference

This document provides rigorous mathematical and algorithmic guidelines for DSP algorithms implemented in **iDJ**.

---

## 1. Biquadratic Digital Filters (IIR)

### General Transfer Function
The standard second-order digital filter in the $z$-domain:
$$H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{a_0 + a_1 z^{-1} + a_2 z^{-2}}$$

Normalized by dividing all coefficients by $a_0$:
$$y[n] = b_0 x[n] + b_1 x[n-1] + b_2 x[n-2] - a_1 y[n-1] - a_2 y[n-2]$$

### Filter Topology: Transposed Direct Form II
Direct Form I requires 4 state delay registers ($x_1, x_2, y_1, y_2$). Direct Form II can suffer severe coefficient quantization and overflow issues under 32-bit floating point math.

**Transposed Direct Form II (TDF-II)** is numerically the most stable representation for real-time modulation:

```
        x[n] ---+------------>( b0 )---------+-----> y[n]
                |                            ^
                |                            |
                +--->( b1 )---+--->[ z^-1 ]--+
                |             ^
                |             |
                +--->( b2 )---+--->[ z^-1 ]
                |             ^
                |             |
               (-a1)<---------+
                |
               (-a2)<---------+
```

**Implementation in C++**:
```cpp
struct TDF2Biquad {
    float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f;
    float a1 = 0.0f, a2 = 0.0f;
    float s1 = 0.0f, s2 = 0.0f; // Only 2 state variables!

    inline float process(float x) {
        float y = b0 * x + s1;
        s1 = b1 * x - a1 * y + s2;
        s2 = b2 * x - a2 * y;
        return y;
    }

    inline void reset() {
        s1 = s2 = 0.0f;
    }
};
```

---

## 2. Robert Bristow-Johnson (RBJ) Cookbook Formulas

Given:
- Sample rate: $f_s$
- Cutoff / Center frequency: $f_0$
- Quality factor / Resonance: $Q$
- Gain in dB: $dBgain$

Derived parameters:
$$\omega_0 = 2\pi \frac{f_0}{f_s}, \quad \cos\omega_0 = \cos(\omega_0), \quad \sin\omega_0 = \sin(\omega_0)$$
$$\alpha = \frac{\sin\omega_0}{2Q}, \quad A = 10^{\frac{dBgain}{40}}$$

### Lowpass Filter
$$b_0 = \frac{1 - \cos\omega_0}{2}, \quad b_1 = 1 - \cos\omega_0, \quad b_2 = \frac{1 - \cos\omega_0}{2}$$
$$a_0 = 1 + \alpha, \quad a_1 = -2\cos\omega_0, \quad a_2 = 1 - \alpha$$

### Highpass Filter
$$b_0 = \frac{1 + \cos\omega_0}{2}, \quad b_1 = -(1 + \cos\omega_0), \quad b_2 = \frac{1 + \cos\omega_0}{2}$$
$$a_0 = 1 + \alpha, \quad a_1 = -2\cos\omega_0, \quad a_2 = 1 - \alpha$$

### Peaking EQ (Mid Band)
$$b_0 = 1 + \alpha A, \quad b_1 = -2\cos\omega_0, \quad b_2 = 1 - \alpha A$$
$$a_0 = 1 + \frac{\alpha}{A}, \quad a_1 = -2\cos\omega_0, \quad a_2 = 1 - \frac{\alpha}{A}$$

### Low Shelf (Bass Band)
Let $\beta = 2\sqrt{A}\alpha$:
$$b_0 = A\left[(A+1) - (A-1)\cos\omega_0 + \beta\right]$$
$$b_1 = 2A\left[(A-1) - (A+1)\cos\omega_0\right]$$
$$b_2 = A\left[(A+1) - (A-1)\cos\omega_0 - \beta\right]$$
$$a_0 = (A+1) + (A-1)\cos\omega_0 + \beta$$
$$a_1 = -2\left[(A-1) + (A+1)\cos\omega_0\right]$$
$$a_2 = (A+1) + (A-1)\cos\omega_0 - \beta$$

---

## 3. Circular Delay Lines & Interpolation

### Delay Line Storage
Always size delay buffers to a **power of two** ($2^N$) so wrapping can be achieved with bitwise AND (`writePos & mask`) instead of expensive modulo division (`%`):
```cpp
class FastDelayLine {
public:
    FastDelayLine(size_t maxSamples) {
        // Find next power of 2
        size_t size = 1;
        while (size < maxSamples) size <<= 1;
        buffer_.resize(size, 0.0f);
        mask_ = size - 1;
        writePos_ = 0;
    }

    inline void write(float sample) {
        buffer_[writePos_] = sample;
        writePos_ = (writePos_ + 1) & mask_;
    }

    // Fractional read via Linear Interpolation (avoids zipper noise on pitch modulation)
    inline float readFractional(float delaySamples) {
        float readPos = static_cast<float>(writePos_) - delaySamples;
        int i0 = static_cast<int>(std::floor(readPos)) & mask_;
        int i1 = (i0 + 1) & mask_;
        float frac = readPos - std::floor(readPos);
        return buffer_[i0] + frac * (buffer_[i1] - buffer_[i0]);
    }

private:
    std::vector<float> buffer_;
    size_t mask_;
    size_t writePos_;
};
```

---

## 4. Time-Domain Effects

### Flanger with Sinusoidal LFO
- Base delay: 1 ms to 5 ms.
- Sweep depth: $\pm 1$ ms to $3$ ms.
- LFO Rate: 0.1 Hz to 1.5 Hz.
- Feedback: 0.0 to 0.7 (higher causes resonance).
- Equation:
  $$\text{delay}[n] = \text{baseDelay} + \text{depth} \cdot \left(\frac{1 + \sin(2\pi f_{\text{lfo}} t)}{2}\right)$$

### Stereo Crossfader Equal Power Curve
$$\text{Deck}_1(x) = \cos\left(\frac{\pi}{2} \cdot x\right), \quad \text{Deck}_2(x) = \sin\left(\frac{\pi}{2} \cdot x\right), \quad x \in [0, 1]$$
At center ($x = 0.5$): $\cos(\pi/4) = \sin(\pi/4) \approx 0.7071$ ($-3\text{dB}$ each, yielding exact unity power $0.7071^2 + 0.7071^2 = 1.0$).
