<template>
  <div class="app-container">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="12">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>Entry Gate Control</span>
          </div>

          <el-form
            ref="entryForm"
            :model="entryForm"
            :rules="rules"
            label-width="100px"
            class="gate-form"
          >
            <el-form-item label="Device ID" prop="deviceId">
              <el-input
                v-model.trim="entryForm.deviceId"
                placeholder="Input entry gate device ID"
                clearable
                @keyup.enter.native="handleControl('entry', 'open')"
              />
            </el-form-item>

            <el-form-item label="Action">
              <el-button
                v-hasPermi="['device:gate:control']"
                type="primary"
                icon="el-icon-unlock"
                :loading="submitting.entry && entryForm.action === 'open'"
                @click="handleControl('entry', 'open')"
              >
                Open
              </el-button>
              <el-button
                v-hasPermi="['device:gate:control']"
                type="warning"
                icon="el-icon-lock"
                :loading="submitting.entry && entryForm.action === 'close'"
                @click="handleControl('entry', 'close')"
              >
                Close
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            title="Entry gate keeps using the current WebSocket control chain."
            type="info"
            :closable="false"
            show-icon
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="12">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>Exit Gate Control</span>
          </div>

          <el-form
            ref="exitForm"
            :model="exitForm"
            :rules="rules"
            label-width="100px"
            class="gate-form"
          >
            <el-form-item label="Device ID" prop="deviceId">
              <el-input
                v-model.trim="exitForm.deviceId"
                placeholder="Input device ID linked to ai-store-host"
                clearable
                @keyup.enter.native="handleControl('exit', 'open')"
              />
            </el-form-item>

            <el-form-item label="Action">
              <el-button
                v-hasPermi="['device:gate:control']"
                type="primary"
                icon="el-icon-unlock"
                :loading="submitting.exit && exitForm.action === 'open'"
                @click="handleControl('exit', 'open')"
              >
                Open
              </el-button>
              <el-button
                v-hasPermi="['device:gate:control']"
                type="warning"
                icon="el-icon-lock"
                :loading="submitting.exit && exitForm.action === 'close'"
                @click="handleControl('exit', 'close')"
              >
                Lock
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            title="Exit gate command is routed through cloud, current host WebSocket tunnel, and local RS485 converter."
            type="success"
            :closable="false"
            show-icon
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="result-row">
      <el-col :xs="24" :sm="24" :md="12">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>Entry Gate Result</span>
          </div>
          <gate-result :result="lastResult.entry" :format-action="formatAction" :format-side="formatSide" />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="12">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>Exit Gate Result</span>
          </div>
          <gate-result :result="lastResult.exit" :format-action="formatAction" :format-side="formatSide" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { controlGate } from '@/api/device/gate'

const GateResult = {
  name: 'GateResult',
  props: {
    result: {
      type: Object,
      default: null
    },
    formatAction: {
      type: Function,
      required: true
    },
    formatSide: {
      type: Function,
      required: true
    }
  },
  template: `
    <div>
      <el-empty v-if="!result" description="No command executed yet" :image-size="90" />
      <el-descriptions v-else :column="1" border>
        <el-descriptions-item label="Device ID">
          {{ result.deviceId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Gate Side">
          {{ formatSide(result.gateSide) }}
        </el-descriptions-item>
        <el-descriptions-item label="Action">
          {{ formatAction(result.action) }}
        </el-descriptions-item>
        <el-descriptions-item label="Online">
          <el-tag :type="result.online ? 'success' : 'danger'" size="small">
            {{ result.online ? 'Online' : 'Offline' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Method">
          {{ result.commandMethod || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Request ID">
          {{ result.reqId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Accepted">
          <el-tag :type="result.accepted ? 'success' : 'danger'" size="small">
            {{ result.accepted ? 'Yes' : 'No' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Message">
          {{ result.message || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  `
}

export default {
  name: 'DeviceGate',
  components: {
    GateResult
  },
  data() {
    return {
      submitting: {
        entry: false,
        exit: false
      },
      entryForm: {
        deviceId: '',
        action: '',
        gateSide: 'entry'
      },
      exitForm: {
        deviceId: '',
        action: '',
        gateSide: 'exit'
      },
      lastResult: {
        entry: null,
        exit: null
      },
      rules: {
        deviceId: [
          { required: true, message: 'Please input device ID', trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    handleControl(gateSide, action) {
      const formRef = gateSide === 'exit' ? 'exitForm' : 'entryForm'
      const form = gateSide === 'exit' ? this.exitForm : this.entryForm
      form.action = action
      this.$refs[formRef].validate(valid => {
        if (!valid) {
          return
        }
        this.submitting[gateSide] = true
        controlGate({
          deviceId: form.deviceId,
          action,
          gateSide
        }).then(response => {
          this.lastResult[gateSide] = response.data
          this.$modal.msgSuccess(response.msg || 'Success')
        }).catch(error => {
          const response = error && error.response && error.response.data
          if (response && response.data) {
            this.lastResult[gateSide] = response.data
          }
        }).finally(() => {
          this.submitting[gateSide] = false
        })
      })
    },
    formatAction(action) {
      if (action === 'open') {
        return 'Open'
      }
      if (action === 'close') {
        return 'Close'
      }
      return action || '-'
    },
    formatSide(gateSide) {
      if (gateSide === 'exit') {
        return 'Exit'
      }
      if (gateSide === 'entry') {
        return 'Entry'
      }
      return gateSide || '-'
    }
  }
}
</script>

<style scoped>
.gate-form {
  margin-bottom: 20px;
}

.result-row {
  margin-top: 20px;
}
</style>
