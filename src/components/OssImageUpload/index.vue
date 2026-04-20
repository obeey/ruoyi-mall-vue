<template>
  <div class="component-upload-image">
    <div v-if="enableCamera && !readonly" class="upload-action-bar">
      <el-button
        size="small"
        icon="el-icon-camera"
        :disabled="fileList.length >= limit"
        @click="openCamera"
      >
        拍照上传
      </el-button>
    </div>
    <el-upload
      multiple
      :action="uploadImgUrl"
      list-type="picture-card"
      :on-success="handleUploadSuccess"
      :before-upload="handleBeforeUpload"
      :limit="limit"
      :on-error="handleUploadError"
      :on-exceed="handleExceed"
      name="file"
      :on-remove="handleRemove"
      :show-file-list="true"
      :headers="headers"
      :file-list="fileList"
      :on-preview="handlePictureCardPreview"
      :class="{ hide: fileList.length >= limit }"
    >
      <i class="el-icon-plus" />
    </el-upload>

    <!-- 上传提示 -->
    <div v-if="showTip" slot="tip" class="el-upload__tip">
      请上传
      <template v-if="fileSize"> 大小不超过 <b style="color: #f56c6c">{{ fileSize }}MB</b> </template>
      <template v-if="fileType"> 格式为 <b style="color: #f56c6c">{{ fileType.join("/") }}</b> </template>
      的文件
    </div>

    <el-dialog
      :visible.sync="dialogVisible"
      title="预览"
      width="800"
      append-to-body
    >
      <img
        :src="dialogImageUrl"
        style="display: block; max-width: 100%; margin: 0 auto"
      >
    </el-dialog>

    <el-dialog
      title="拍照上传"
      :visible.sync="cameraVisible"
      width="720px"
      append-to-body
      :close-on-click-modal="false"
      @open="handleCameraDialogOpen"
      @closed="handleCameraDialogClosed"
    >
      <div class="camera-panel">
        <div v-if="cameraOptions.length > 1" class="camera-toolbar">
          <span class="camera-toolbar__label">选择摄像头</span>
          <el-select
            v-model="selectedDeviceId"
            placeholder="请选择摄像头"
            size="small"
            @change="handleCameraChange"
          >
            <el-option
              v-for="item in cameraOptions"
              :key="item.deviceId"
              :label="item.label"
              :value="item.deviceId"
            />
          </el-select>
        </div>

        <div class="camera-preview">
          <video
            v-show="!capturedImageUrl"
            ref="cameraVideo"
            autoplay
            playsinline
            muted
          />
          <img
            v-if="capturedImageUrl"
            :src="capturedImageUrl"
            alt="captured"
          >
          <canvas ref="cameraCanvas" class="camera-canvas" />
        </div>

        <div class="camera-tip">
          <span v-if="cameraError" class="camera-error">{{ cameraError }}</span>
          <span v-else>{{ cameraTip }}</span>
        </div>
      </div>

      <span slot="footer" class="dialog-footer">
        <el-button @click="cameraVisible = false">取消</el-button>
        <el-button v-if="capturedImageUrl" @click="retakePhoto">重拍</el-button>
        <el-button
          v-if="!capturedImageUrl"
          type="primary"
          :disabled="!!cameraError"
          @click="capturePhoto"
        >
          拍照
        </el-button>
        <el-button
          v-if="capturedImageUrl"
          type="primary"
          :loading="cameraUploading"
          @click="uploadCapturedImage"
        >
          上传
        </el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { getToken } from '@/utils/auth'
import request from '@/utils/request'

export default {
  name: 'OssImageUpload',
  props: {
    value: {
      type: [String, Object, Array],
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    },
    // 图片数量限制
    limit: {
      type: Number,
      default: 5
    },
    // 大小限制(MB)
    fileSize: {
      type: Number,
      default: 5
    },
    // 文件类型, 例如['png', 'jpg', 'jpeg']
    fileType: {
      type: Array,
      default: () => ['png', 'jpg', 'jpeg']
    },
    // 是否显示提示
    isShowTip: {
      type: Boolean,
      default: true
    },
    enableCamera: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      number: 0,
      uploadList: [],
      dialogImageUrl: '',
      dialogVisible: false,
      hideUpload: false,
      baseUrl: process.env.VUE_APP_BASE_API,
      uploadImgUrl: process.env.VUE_APP_BASE_API + '/oss/upload', // 上传的图片服务器地址
      headers: {
        Authorization: 'Bearer ' + getToken()
      },
      fileList: [],
      cameraVisible: false,
      cameraStream: null,
      cameraOptions: [],
      selectedDeviceId: '',
      cameraError: '',
      cameraTip: '请调整构图后拍照上传',
      capturedImageUrl: '',
      capturedBlob: null,
      cameraUploading: false
    }
  },
  computed: {
    // 是否显示提示
    showTip() {
      return this.isShowTip && (this.fileType || this.fileSize)
    }
  },
  watch: {
    value: {
      handler(val) {
        if (val) {
          // 首先将值转为数组
          const list = Array.isArray(val) ? val : this.value.split(',')
          // 然后将数组转为对象数组
          this.fileList = list.map(item => {
            if (typeof item === 'string') {
              item = { name: item, url: item }
            }
            return item
          })
        } else {
          this.fileList = []
          return []
        }
      },
      deep: true,
      immediate: true
    }
  },
  beforeDestroy() {
    this.stopCameraPreview()
  },
  methods: {
    openCamera() {
      this.cameraVisible = true
    },
    async handleCameraDialogOpen() {
      this.cameraError = ''
      this.cameraTip = '正在打开摄像头...'
      this.capturedImageUrl = ''
      this.capturedBlob = null
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        this.cameraError = '当前环境不支持调用摄像头，请使用 HTTPS 或本机地址访问。'
        return
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.cameraError = '当前浏览器不支持摄像头访问。'
        return
      }
      await this.initCameras()
      await this.startCameraPreview()
    },
    handleCameraDialogClosed() {
      this.stopCameraPreview()
      this.capturedImageUrl = ''
      this.capturedBlob = null
      this.cameraUploading = false
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
    async startCameraPreview() {
      this.stopCameraPreview()
      try {
        const constraints = this.selectedDeviceId
          ? {
            video: {
              deviceId: { exact: this.selectedDeviceId }
            },
            audio: false
          }
          : {
            video: {
              facingMode: 'environment'
            },
            audio: false
          }
        this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints)
        const video = this.$refs.cameraVideo
        if (!video) {
          return
        }
        video.srcObject = this.cameraStream
        await video.play()
        await this.initCameras()
        this.cameraTip = '请调整构图后拍照上传'
      } catch (error) {
        this.cameraError = '摄像头打开失败，请检查浏览器权限后重试。'
      }
    },
    async handleCameraChange() {
      if (!this.cameraVisible) {
        return
      }
      this.cameraTip = '正在切换摄像头...'
      this.capturedImageUrl = ''
      this.capturedBlob = null
      await this.startCameraPreview()
    },
    capturePhoto() {
      const video = this.$refs.cameraVideo
      const canvas = this.$refs.cameraCanvas
      if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
        this.cameraError = '当前未获取到画面，请稍后重试。'
        return
      }
      const context = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (!blob) {
          this.cameraError = '拍照失败，请重试。'
          return
        }
        this.capturedBlob = blob
        this.capturedImageUrl = URL.createObjectURL(blob)
        this.cameraTip = '已拍照，可直接上传或重新拍一张'
      }, 'image/jpeg', 0.92)
    },
    retakePhoto() {
      if (this.capturedImageUrl) {
        URL.revokeObjectURL(this.capturedImageUrl)
      }
      this.capturedImageUrl = ''
      this.capturedBlob = null
      this.cameraError = ''
      this.cameraTip = '请调整构图后拍照上传'
    },
    async uploadCapturedImage() {
      if (!this.capturedBlob) {
        this.cameraError = '请先拍照后再上传。'
        return
      }
      if (!this.handleBeforeUpload(this.buildCapturedFile())) {
        return
      }
      const formData = new FormData()
      formData.append('file', this.capturedBlob, this.buildFileName())
      this.cameraUploading = true
      try {
        const res = await request({
          url: '/oss/upload',
          method: 'post',
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
            repeatSubmit: false
          }
        })
        this.handleUploadSuccess(res)
        this.cameraVisible = false
      } catch (error) {
        this.handleUploadError()
      } finally {
        this.cameraUploading = false
      }
    },
    buildFileName() {
      const now = new Date()
      const pad = value => `${value}`.padStart(2, '0')
      return `camera_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`
    },
    buildCapturedFile() {
      return {
        name: this.buildFileName(),
        size: this.capturedBlob ? this.capturedBlob.size : 0,
        type: this.capturedBlob ? this.capturedBlob.type : 'image/jpeg'
      }
    },
    stopCameraPreview() {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(track => track.stop())
        this.cameraStream = null
      }
      if (this.$refs.cameraVideo) {
        this.$refs.cameraVideo.srcObject = null
      }
      if (this.capturedImageUrl) {
        URL.revokeObjectURL(this.capturedImageUrl)
      }
      this.capturedImageUrl = ''
    },
    // 删除图片
    handleRemove(file, fileList) {
      const findex = this.fileList.map(f => f.name).indexOf(file.name)
      if (findex > -1) {
        this.fileList.splice(findex, 1)
        this.$emit('input', this.listToString(this.fileList))
      }
    },
    // 上传成功回调
    handleUploadSuccess(res) {
      this.uploadList.push({ name: res.fileName, url: res.url })
      if (this.uploadList.length === this.number) {
        this.fileList = this.fileList.concat(this.uploadList)
        this.uploadList = []
        this.number = 0
        this.$emit('input', this.listToString(this.fileList))
        this.$modal.closeLoading()
      }
    },
    // 上传前loading加载
    handleBeforeUpload(file) {
      let isImg = false
      if (this.fileType.length) {
        let fileExtension = ''
        if (file.name.lastIndexOf('.') > -1) {
          fileExtension = file.name.slice(file.name.lastIndexOf('.') + 1)
        }
        isImg = this.fileType.some(type => {
          if (file.type.indexOf(type) > -1) return true
          if (fileExtension && fileExtension.indexOf(type) > -1) return true
          return false
        })
      } else {
        isImg = file.type.indexOf('image') > -1
      }

      if (!isImg) {
        this.$modal.msgError(`文件格式不正确, 请上传${this.fileType.join('/')}图片格式文件!`)
        return false
      }
      if (this.fileSize) {
        const isLt = file.size / 1024 / 1024 < this.fileSize
        if (!isLt) {
          this.$modal.msgError(`上传头像图片大小不能超过 ${this.fileSize} MB!`)
          return false
        }
      }
      this.$modal.loading('正在上传图片，请稍候...')
      this.number++
    },
    // 文件个数超出
    handleExceed() {
      this.$modal.msgError(`上传文件数量不能超过 ${this.limit} 个!`)
    },
    // 上传失败
    handleUploadError() {
      this.number = 0
      this.uploadList = []
      this.$modal.msgError('上传图片失败，请重试')
      this.$modal.closeLoading()
    },
    // 预览
    handlePictureCardPreview(file) {
      this.dialogImageUrl = file.url
      this.dialogVisible = true
    },
    // 对象转成指定字符串分隔
    listToString(list, separator) {
      let strs = ''
      separator = separator || ','
      for (const i in list) {
        strs += list[i].url.replace(this.baseUrl, '') + separator
      }
      return strs !== '' ? strs.substr(0, strs.length - 1) : ''
    }
  }
}
</script>
<style scoped lang="scss">
.upload-action-bar {
    margin-bottom: 10px;
}

// .el-upload--picture-card 控制加号部分
::v-deep.hide .el-upload--picture-card {
    display: none;
}
// 去掉动画效果
::v-deep .el-list-enter-active,
::v-deep .el-list-leave-active {
    transition: all 0s;
}

::v-deep .el-list-enter, .el-list-leave-active {
    opacity: 0;
    transform: translateY(0);
}

.camera-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.camera-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
}

.camera-toolbar__label {
    color: #606266;
    flex-shrink: 0;
}

.camera-preview {
    position: relative;
    width: 100%;
    min-height: 360px;
    border-radius: 8px;
    overflow: hidden;
    background: #111827;
}

.camera-preview video,
.camera-preview img {
    display: block;
    width: 100%;
    min-height: 360px;
    object-fit: cover;
}

.camera-canvas {
    display: none;
}

.camera-tip {
    text-align: center;
    color: #606266;
}

.camera-error {
    color: #f56c6c;
}
</style>
