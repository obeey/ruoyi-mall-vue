<template>
  <div class="app-container">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="14" :lg="12">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>闸机控制</span>
          </div>

          <el-form
            ref="form"
            :model="form"
            :rules="rules"
            label-width="90px"
            class="gate-form"
          >
            <el-form-item label="设备 ID" prop="deviceId">
              <el-input
                v-model.trim="form.deviceId"
                placeholder="请输入闸机设备ID，例如 R71SA52720001"
                clearable
                @keyup.enter.native="handleControl('open')"
              />
            </el-form-item>

            <el-form-item label="控制动作">
              <el-button
                v-hasPermi="['device:gate:control']"
                type="primary"
                icon="el-icon-unlock"
                :loading="submitting && form.action === 'open'"
                @click="handleControl('open')"
              >
                开闸
              </el-button>
              <el-button
                v-hasPermi="['device:gate:control']"
                type="warning"
                icon="el-icon-lock"
                :loading="submitting && form.action === 'close'"
                @click="handleControl('close')"
              >
                关闸
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            title="当前页面用于后台人工测试控闸，设备必须已通过 WebSocket 在线连接到服务端。"
            type="info"
            :closable="false"
            show-icon
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="10" :lg="12">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>最近结果</span>
          </div>

          <el-descriptions v-if="lastResult" :column="1" border>
            <el-descriptions-item label="设备 ID">
              {{ lastResult.deviceId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="动作">
              {{ formatAction(lastResult.action) }}
            </el-descriptions-item>
            <el-descriptions-item label="是否在线">
              <el-tag :type="lastResult.online ? 'success' : 'danger'" size="small">
                {{ lastResult.online ? '在线' : '离线' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="下发方法">
              {{ lastResult.commandMethod || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="请求 ID">
              {{ lastResult.reqId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="结果">
              <el-tag :type="lastResult.accepted ? 'success' : 'danger'" size="small">
                {{ lastResult.accepted ? '已下发' : '未下发' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="消息">
              {{ lastResult.message || '-' }}
            </el-descriptions-item>
          </el-descriptions>

          <el-empty v-else description="尚未执行控闸操作" :image-size="90" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { controlGate } from '@/api/device/gate'

export default {
  name: 'DeviceGate',
  data() {
    return {
      submitting: false,
      form: {
        deviceId: '',
        action: ''
      },
      lastResult: null,
      rules: {
        deviceId: [
          { required: true, message: '请输入闸机设备ID', trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    handleControl(action) {
      this.form.action = action
      this.$refs.form.validate(valid => {
        if (!valid) {
          return
        }
        this.submitting = true
        controlGate({
          deviceId: this.form.deviceId,
          action: action
        }).then(response => {
          this.lastResult = response.data
          this.$modal.msgSuccess(response.msg || '操作成功')
        }).catch(error => {
          const response = error && error.response && error.response.data
          if (response && response.data) {
            this.lastResult = response.data
          }
        }).finally(() => {
          this.submitting = false
        })
      })
    },
    formatAction(action) {
      if (action === 'open') {
        return '开闸'
      }
      if (action === 'close') {
        return '关闸'
      }
      return action || '-'
    }
  }
}
</script>

<style scoped>
.gate-form {
  margin-bottom: 20px;
}
</style>
