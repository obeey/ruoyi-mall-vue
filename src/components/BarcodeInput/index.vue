<template>
  <div class="barcode-input">
    <el-input
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="handleInput"
    >
      <template slot="append">
        <el-button
          icon="el-icon-camera"
          :disabled="disabled"
          @click="openScanner"
        >
          扫码录入
        </el-button>
      </template>
    </el-input>

    <el-dialog
      title="扫码录入商品编码"
      :visible.sync="scannerVisible"
      width="720px"
      append-to-body
      :close-on-click-modal="false"
      @open="handleDialogOpen"
      @closed="handleDialogClosed"
    >
      <div class="scanner-panel">
        <div v-if="cameraOptions.length > 1" class="scanner-toolbar">
          <span class="scanner-toolbar__label">选择摄像头</span>
          <el-select
            v-model="selectedDeviceId"
            placeholder="请选择摄像头"
            size="small"
            @change="handleDeviceChange"
          >
            <el-option
              v-for="item in cameraOptions"
              :key="item.deviceId"
              :label="item.label"
              :value="item.deviceId"
            />
          </el-select>
        </div>

        <div class="scanner-preview">
          <video
            ref="video"
            autoplay
            playsinline
            muted
          />
          <div class="scanner-frame" />
          <canvas ref="captureCanvas" class="scanner-canvas" />
        </div>

        <div class="scanner-tip">
          <span v-if="scannerError" class="scanner-error">{{ scannerError }}</span>
          <span v-else>{{ scannerTip }}</span>
        </div>
      </div>

      <span slot="footer" class="dialog-footer">
        <input
          ref="imageInput"
          class="scanner-file-input"
          type="file"
          accept="image/*"
          @change="handleImageSelect"
        >
        <el-button :loading="uploadLoading" @click="triggerImageUpload">上传图片识别</el-button>
        <el-button :loading="captureLoading" @click="captureAndDecode">拍照识别</el-button>
        <el-button @click="scannerVisible = false">取消</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import Quagga from '@ericblade/quagga2'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

export default {
  name: 'BarcodeInput',
  props: {
    value: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: '请输入商品编码'
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      scannerVisible: false,
      stream: null,
      detector: null,
      zxingReader: null,
      zxingControls: null,
      scanTimer: null,
      cameraOptions: [],
      selectedDeviceId: '',
      scannerError: '',
      scannerTip: '请将商品条码放入取景框内',
      scannerEngine: '',
      captureLoading: false,
      uploadLoading: false
    }
  },
  beforeDestroy() {
    this.stopScanner()
  },
  methods: {
    handleInput(value) {
      this.$emit('input', value)
    },
    openScanner() {
      this.scannerVisible = true
    },
    async handleDialogOpen() {
      this.scannerError = ''
      this.scannerTip = '正在打开摄像头...'
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        this.scannerError = '当前环境不支持调用摄像头，请使用 HTTPS 或本机地址访问。'
        return
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.scannerError = '当前浏览器不支持摄像头访问，请改用手工输入。'
        return
      }
      this.initScannerEngine()
      await this.initCameras()
      await this.startScanner()
    },
    handleDialogClosed() {
      this.stopScanner()
    },
    async initCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter(item => item.kind === 'videoinput')
        this.cameraOptions = cameras.map((item, index) => ({
          deviceId: item.deviceId,
          label: item.label || `摄像头 ${index + 1}`
        }))
        if (!this.selectedDeviceId && this.cameraOptions.length) {
          const backCamera = this.cameraOptions.find(item => /back|rear|environment|后置/i.test(item.label))
          this.selectedDeviceId = (backCamera || this.cameraOptions[0]).deviceId
        }
      } catch (error) {
        this.cameraOptions = []
      }
    },
    async startScanner() {
      if (this.scannerEngine === 'native') {
        await this.startNativeScanner()
        return
      }
      if (this.scannerEngine === 'zxing') {
        await this.startZxingScanner()
        return
      }
      this.scannerError = '当前环境暂不支持扫码识别，请改用手工输入。'
    },
    initScannerEngine() {
      this.detector = null
      this.zxingReader = null
      this.zxingControls = null
      this.scannerEngine = ''
      if (typeof window.BarcodeDetector !== 'undefined') {
        try {
          this.detector = new window.BarcodeDetector({
            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'codabar',
              'itf'
            ]
          })
          this.scannerEngine = 'native'
          return
        } catch (error) {
          this.detector = null
        }
      }
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.CODABAR,
        BarcodeFormat.ITF,
        BarcodeFormat.RSS_14,
        BarcodeFormat.RSS_EXPANDED
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)
      this.zxingReader = new BrowserMultiFormatReader(hints)
      this.scannerEngine = 'zxing'
    },
    async startNativeScanner() {
      this.stopStream()
      try {
        const constraints = this.buildConstraints()
        this.stream = await navigator.mediaDevices.getUserMedia(constraints)
        const video = this.$refs.video
        if (!video) {
          return
        }
        video.srcObject = this.stream
        await video.play()
        await this.applyVideoTrackConstraints()
        await this.initCameras()
        this.scannerTip = '请将条码尽量贴近镜头，保持充足光线；识别慢时可点“拍照识别”'
        this.startNativeDetectLoop()
      } catch (error) {
        this.scannerError = '摄像头打开失败，请检查浏览器权限后重试。'
      }
    },
    startNativeDetectLoop() {
      this.clearScanTimer()
      this.scanTimer = window.setInterval(async() => {
        if (!this.detector || !this.$refs.video || !this.scannerVisible) {
          return
        }
        const video = this.$refs.video
        if (video.readyState < 2) {
          return
        }
        try {
          const barcodes = await this.detector.detect(video)
          if (barcodes && barcodes.length) {
            this.handleLiveDecode({
              text: barcodes[0].rawValue,
              format: barcodes[0].format,
              source: 'native'
            })
          }
        } catch (error) {
          this.scannerError = '条码识别失败，请调整角度或改用手工输入。'
          this.clearScanTimer()
        }
      }, 350)
    },
    async startZxingScanner() {
      this.stopScannerRuntime()
      const video = this.$refs.video
      if (!video || !this.zxingReader) {
        this.scannerError = '扫码识别器初始化失败，请改用手工输入。'
        return
      }
      this.scannerTip = '请将条码尽量贴近镜头，保持充足光线；识别慢时可点“拍照识别”'
      try {
        this.zxingControls = await this.zxingReader.decodeFromConstraints(
          this.buildConstraints(),
          video,
          (result, error) => {
            if (result) {
              this.handleLiveDecode({
                text: result.getText(),
                format: this.normalizeZxingFormat(result.getBarcodeFormat()),
                source: 'zxing'
              })
            } else if (error && error.name !== 'NotFoundException') {
              this.scannerError = '条码识别失败，请调整角度或改用手工输入。'
            }
          }
        )
        await this.initCameras()
      } catch (error) {
        this.scannerError = '摄像头打开失败，请检查浏览器权限后重试。'
      }
    },
    buildConstraints() {
      return this.selectedDeviceId
        ? {
          video: {
            deviceId: { exact: this.selectedDeviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        }
        : {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        }
    },
    async applyVideoTrackConstraints() {
      const tracks = this.stream ? this.stream.getVideoTracks() : []
      if (!tracks.length) {
        return
      }
      const [track] = tracks
      if (!track || typeof track.applyConstraints !== 'function') {
        return
      }
      const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}
      const advanced = []
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' })
      }
      if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' })
      }
      if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' })
      }
      if (capabilities.zoom && typeof capabilities.zoom.max === 'number' && capabilities.zoom.max > 1) {
        advanced.push({ zoom: Math.min(2, capabilities.zoom.max) })
      }
      if (!advanced.length) {
        return
      }
      try {
        await track.applyConstraints({ advanced })
      } catch (error) {
        // 某些浏览器不支持动态对焦/缩放约束，忽略即可
      }
    },
    async captureAndDecode() {
      const video = this.$refs.video
      const canvas = this.$refs.captureCanvas
      if (!video || !canvas || !this.zxingReader) {
        this.scannerError = '当前无法拍照识别，请稍后重试。'
        return
      }
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        this.scannerError = '摄像头画面尚未就绪，请稍后重试。'
        return
      }
      this.captureLoading = true
      this.scannerError = ''
      try {
        const context = canvas.getContext('2d')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const result = await this.decodeFromProcessedCanvas(canvas)
        this.handleDecodeSuccess(result.text)
      } catch (error) {
        this.scannerError = '拍照识别失败，或结果未通过商品条码校验。请把条码放大一些、保持平整并避免反光。'
      } finally {
        this.captureLoading = false
      }
    },
    triggerImageUpload() {
      if (this.$refs.imageInput) {
        this.$refs.imageInput.click()
      }
    },
    async handleImageSelect(event) {
      const [file] = event.target.files || []
      if (!file) {
        return
      }
      this.uploadLoading = true
      this.scannerError = ''
      try {
        const image = await this.loadImageFile(file)
        const canvas = this.createCanvasFromImage(image)
        const result = await this.decodeFromProcessedCanvas(canvas)
        this.handleDecodeSuccess(result.text)
      } catch (error) {
        this.scannerError = '上传图片识别失败，或结果未通过商品条码校验。请尽量选择清晰、完整、无反光的条码图片。'
      } finally {
        this.uploadLoading = false
        if (this.$refs.imageInput) {
          this.$refs.imageInput.value = ''
        }
      }
    },
    loadImageFile(file) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
          resolve(image)
        }
        image.onerror = () => {
          reject(new Error('image load failed'))
        }
        image.src = URL.createObjectURL(file)
      })
    },
    createCanvasFromImage(image) {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas
    },
    async decodeFromProcessedCanvas(sourceCanvas) {
      const attempts = this.buildDecodeCanvases(sourceCanvas)
      const looseMatches = []
      for (const attemptCanvas of attempts) {
        const candidates = await this.decodeCandidatesFromCanvas(attemptCanvas)
        const strictMatch = this.findStrictCandidate(candidates)
        if (strictMatch) {
          return strictMatch
        }
        const agreedCandidate = this.findAgreedCandidate(candidates)
        if (agreedCandidate) {
          return agreedCandidate
        }
        looseMatches.push(...candidates.filter(candidate => candidate.text))
      }
      const repeatedCandidate = this.findRepeatedCandidate(looseMatches)
      if (repeatedCandidate) {
        return repeatedCandidate
      }
      throw new Error('decode failed')
    },
    async decodeCandidatesFromCanvas(canvas) {
      const candidates = []
      try {
        const quaggaResult = await this.decodeWithQuagga(canvas)
        if (quaggaResult && quaggaResult.text) {
          candidates.push(quaggaResult)
        }
      } catch (error) {
        // 忽略单次失败，继续尝试另一种识别器
      }
      try {
        const zxingResult = this.zxingReader.decodeFromCanvas(canvas)
        if (zxingResult && zxingResult.getText()) {
          candidates.push({
            text: zxingResult.getText(),
            format: this.normalizeZxingFormat(zxingResult.getBarcodeFormat()),
            source: 'zxing'
          })
        }
      } catch (error) {
        // 忽略单次失败，继续尝试下一种图像处理方案
      }
      return candidates
    },
    decodeWithQuagga(canvas) {
      const configs = [
        {
          locate: true,
          halfSample: false,
          patchSize: 'medium',
          size: 0
        },
        {
          locate: true,
          halfSample: false,
          patchSize: 'large',
          size: 1200
        },
        {
          locate: false,
          halfSample: false,
          patchSize: 'medium',
          size: 0
        }
      ]
      return configs.reduce(async(previous, config) => {
        const result = await previous
        if (result && result.text) {
          return result
        }
        return this.runQuaggaDecode(canvas, config)
      }, Promise.resolve(null))
    },
    runQuaggaDecode(canvas, config) {
      const readers = [
        'ean_reader',
        'upc_reader',
        'upc_e_reader',
        'ean_8_reader',
        'code_128_reader',
        'code_39_reader',
        'code_93_reader',
        'codabar_reader',
        'i2of5_reader',
        '2of5_reader'
      ]
      return new Promise(resolve => {
        Quagga.decodeSingle({
          src: canvas.toDataURL('image/png'),
          numOfWorkers: 0,
          locate: config.locate,
          inputStream: {
            size: config.size,
            singleChannel: false
          },
          locator: {
            halfSample: config.halfSample,
            patchSize: config.patchSize
          },
          decoder: {
            readers
          }
        }, result => {
          resolve(result && result.codeResult
            ? {
              text: result.codeResult.code,
              format: result.codeResult.format,
              source: 'quagga'
            }
            : null)
        })
      })
    },
    handleLiveDecode(candidate) {
      const normalized = this.normalizeCandidate(candidate)
      if (!normalized.text) {
        return
      }
      if (!this.isStrictlyValidCandidate(normalized)) {
        return
      }
      this.handleDecodeSuccess(normalized.text)
    },
    findStrictCandidate(candidates) {
      const normalizedCandidates = candidates.map(candidate => this.normalizeCandidate(candidate))
      return normalizedCandidates.find(candidate => this.isStrictlyValidCandidate(candidate)) || null
    },
    findAgreedCandidate(candidates) {
      const normalizedCandidates = candidates.map(candidate => this.normalizeCandidate(candidate)).filter(candidate => candidate.text)
      for (let index = 0; index < normalizedCandidates.length; index++) {
        for (let nextIndex = index + 1; nextIndex < normalizedCandidates.length; nextIndex++) {
          if (normalizedCandidates[index].text === normalizedCandidates[nextIndex].text) {
            return normalizedCandidates[index]
          }
        }
      }
      return null
    },
    findRepeatedCandidate(candidates) {
      const counter = new Map()
      const normalizedCandidates = candidates.map(candidate => this.normalizeCandidate(candidate))
      normalizedCandidates.forEach(candidate => {
        if (!candidate.text) {
          return
        }
        counter.set(candidate.text, (counter.get(candidate.text) || 0) + 1)
      })
      for (const candidate of normalizedCandidates) {
        if (candidate.text && counter.get(candidate.text) >= 2 && this.isPlausibleCandidate(candidate)) {
          return candidate
        }
      }
      return null
    },
    normalizeCandidate(candidate) {
      const rawText = candidate && candidate.text ? String(candidate.text) : ''
      const normalizedText = rawText.replace(/\s+/g, '').replace(/[^0-9A-Za-z\-.]/g, '')
      return {
        text: normalizedText,
        format: this.normalizeFormat(candidate && candidate.format),
        source: candidate && candidate.source ? candidate.source : ''
      }
    },
    normalizeFormat(format) {
      if (!format && format !== 0) {
        return ''
      }
      return String(format).toUpperCase()
    },
    normalizeZxingFormat(format) {
      if (typeof format === 'number' && BarcodeFormat[format]) {
        return BarcodeFormat[format]
      }
      return this.normalizeFormat(format)
    },
    isStrictlyValidCandidate(candidate) {
      if (!candidate.text) {
        return false
      }
      if (this.isChecksumBarcode(candidate.format)) {
        return this.validateChecksumCandidate(candidate)
      }
      return false
    },
    isPlausibleCandidate(candidate) {
      if (!candidate.text) {
        return false
      }
      if (this.isChecksumBarcode(candidate.format)) {
        return this.validateChecksumCandidate(candidate)
      }
      return /^[0-9A-Za-z\-\.]+$/.test(candidate.text) && candidate.text.length >= 8
    },
    isChecksumBarcode(format) {
      return ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'].includes(this.normalizeFormat(format))
    },
    validateChecksumCandidate(candidate) {
      const format = this.normalizeFormat(candidate.format)
      const text = candidate.text
      if (!/^\d+$/.test(text)) {
        return false
      }
      if (format === 'EAN_13') {
        return text.length === 13 && this.computeModulo10CheckDigit(text.slice(0, 12)) === Number(text[12])
      }
      if (format === 'EAN_8') {
        return text.length === 8 && this.computeModulo10CheckDigit(text.slice(0, 7)) === Number(text[7])
      }
      if (format === 'UPC_A') {
        return text.length === 12 && this.computeModulo10CheckDigit(text.slice(0, 11)) === Number(text[11])
      }
      if (format === 'UPC_E') {
        return text.length === 8
      }
      return false
    },
    computeModulo10CheckDigit(body) {
      const digits = body.split('').map(item => Number(item))
      const parity = body.length % 2 === 0 ? 1 : 3
      const sum = digits.reduce((total, digit, index) => {
        return total + digit * (index % 2 === 0 ? parity : 4 - parity)
      }, 0)
      return (10 - (sum % 10)) % 10
    },
    buildDecodeCanvases(sourceCanvas) {
      const attempts = []
      attempts.push(this.cloneCanvas(sourceCanvas))
      attempts.push(this.createBarcodeFocusedCanvas(sourceCanvas, { cropRatio: 1, scale: 2, padding: 80 }))
      attempts.push(this.createBarcodeFocusedCanvas(sourceCanvas, { cropRatio: 0.9, scale: 2.4, padding: 100 }))
      attempts.push(this.createBarcodeFocusedCanvas(sourceCanvas, { cropRatio: 0.78, scale: 2.8, padding: 120 }))
      attempts.push(this.createEnhancedCanvas(sourceCanvas, { cropRatio: 1, scale: 2.2, padding: 90, contrast: 1.4, grayscale: true }))
      attempts.push(this.createEnhancedCanvas(sourceCanvas, { cropRatio: 0.9, scale: 2.6, padding: 100, contrast: 1.7, grayscale: true }))
      attempts.push(this.createEnhancedCanvas(sourceCanvas, { cropRatio: 0.78, scale: 3, padding: 120, contrast: 2, grayscale: true, binarize: true }))
      return attempts
    },
    cloneCanvas(sourceCanvas) {
      const canvas = document.createElement('canvas')
      canvas.width = sourceCanvas.width
      canvas.height = sourceCanvas.height
      const context = canvas.getContext('2d')
      context.drawImage(sourceCanvas, 0, 0)
      return canvas
    },
    createBarcodeFocusedCanvas(sourceCanvas, options) {
      const {
        cropRatio = 1,
        scale = 2,
        padding = 80
      } = options || {}
      const cropWidth = Math.max(1, Math.floor(sourceCanvas.width * cropRatio))
      const cropHeight = Math.max(1, Math.floor(sourceCanvas.height * 0.48))
      const cropX = Math.max(0, Math.floor((sourceCanvas.width - cropWidth) / 2))
      const cropY = Math.max(0, Math.floor(sourceCanvas.height * 0.2))
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(cropWidth * scale) + padding * 2
      canvas.height = Math.floor(cropHeight * scale) + padding * 2
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.imageSmoothingEnabled = false
      context.drawImage(
        sourceCanvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        padding,
        padding,
        Math.floor(cropWidth * scale),
        Math.floor(cropHeight * scale)
      )
      return canvas
    },
    createEnhancedCanvas(sourceCanvas, options) {
      const canvas = this.createBarcodeFocusedCanvas(sourceCanvas, options)
      const context = canvas.getContext('2d')
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const {
        grayscale = false,
        contrast = 1,
        binarize = false
      } = options || {}
      const data = imageData.data
      for (let index = 0; index < data.length; index += 4) {
        let red = data[index]
        let green = data[index + 1]
        let blue = data[index + 2]
        if (grayscale) {
          const gray = red * 0.299 + green * 0.587 + blue * 0.114
          red = gray
          green = gray
          blue = gray
        }
        red = this.adjustContrast(red, contrast)
        green = this.adjustContrast(green, contrast)
        blue = this.adjustContrast(blue, contrast)
        if (binarize) {
          const gray = (red + green + blue) / 3
          const value = gray > 160 ? 255 : 0
          red = value
          green = value
          blue = value
        }
        data[index] = red
        data[index + 1] = green
        data[index + 2] = blue
      }
      context.putImageData(imageData, 0, 0)
      return canvas
    },
    adjustContrast(value, contrast) {
      const adjusted = ((value - 128) * contrast) + 128
      return Math.max(0, Math.min(255, adjusted))
    },
    handleDecodeSuccess(rawValue) {
      if (!rawValue) {
        return
      }
      this.$emit('input', rawValue)
      this.$emit('scan-success', rawValue)
      this.$message.success('扫码成功')
      this.scannerVisible = false
    },
    async handleDeviceChange() {
      if (!this.scannerVisible) {
        return
      }
      this.scannerTip = '正在切换摄像头...'
      await this.startScanner()
    },
    stopScanner() {
      this.clearScanTimer()
      this.stopScannerRuntime()
      this.stopStream()
    },
    stopScannerRuntime() {
      if (this.zxingControls) {
        this.zxingControls.stop()
        this.zxingControls = null
      }
      if (this.zxingReader && typeof this.zxingReader.reset === 'function') {
        this.zxingReader.reset()
      }
      this.detector = this.scannerEngine === 'native' ? this.detector : null
      this.scannerError = ''
    },
    clearScanTimer() {
      if (this.scanTimer) {
        window.clearInterval(this.scanTimer)
        this.scanTimer = null
      }
    },
    stopStream() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
        this.stream = null
      }
      if (this.$refs.video) {
        this.$refs.video.srcObject = null
      }
    }
  }
}
</script>

<style scoped lang="scss">
.barcode-input {
  width: 100%;
}

.scanner-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scanner-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scanner-toolbar__label {
  color: #606266;
  flex-shrink: 0;
}

.scanner-preview {
  position: relative;
  width: 100%;
  min-height: 360px;
  border-radius: 8px;
  overflow: hidden;
  background: #111827;
}

.scanner-preview video {
  display: block;
  width: 100%;
  min-height: 360px;
  object-fit: cover;
}

.scanner-canvas {
  display: none;
}

.scanner-file-input {
  display: none;
}

.scanner-frame {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 72%;
  max-width: 420px;
  aspect-ratio: 2.6 / 1;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.22);
}

.scanner-tip {
  text-align: center;
  color: #606266;
}

.scanner-error {
  color: #f56c6c;
}
</style>
