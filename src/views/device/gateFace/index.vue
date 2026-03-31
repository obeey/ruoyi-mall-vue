<template>
  <div class="app-container">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="14" :lg="13">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>闸机人脸设置</span>
          </div>

          <el-form
            ref="form"
            :model="form"
            :rules="rules"
            label-width="100px"
            class="gate-form"
          >
            <el-form-item label="选择会员">
              <el-button type="primary" plain icon="el-icon-search" @click="openMemberDialog">
                选择会员
              </el-button>
              <el-button v-if="selectedMember" type="text" @click="clearSelectedMember">
                清空
              </el-button>
            </el-form-item>

            <el-form-item label="已选会员">
              <el-descriptions v-if="selectedMember" :column="1" border size="small">
                <el-descriptions-item label="会员ID">
                  {{ selectedMember.id }}
                </el-descriptions-item>
                <el-descriptions-item label="昵称">
                  {{ selectedMember.nickname || '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="手机号">
                  {{ selectedMember.phoneHidden || '-' }}
                </el-descriptions-item>
              </el-descriptions>
              <el-empty v-else description="请先搜索并选择会员" :image-size="60" />
            </el-form-item>

            <el-form-item label="设备 ID" prop="deviceId">
              <el-input
                v-model.trim="form.deviceId"
                placeholder="请输入闸机设备ID"
                clearable
              />
            </el-form-item>

            <el-form-item label="会员 ID" prop="memberId">
              <el-input
                v-model.number="form.memberId"
                placeholder="请输入会员ID，二维码将自动按 qr/token 逻辑生成"
                clearable
              />
            </el-form-item>

            <el-form-item label="人员姓名" prop="personName">
              <el-input
                v-model.trim="form.personName"
                placeholder="可选，不填默认取会员昵称"
                clearable
              />
            </el-form-item>

            <el-form-item label="人员分组" prop="subset">
              <el-radio-group v-model="form.subset">
                <el-radio :label="0">白名单</el-radio>
                <el-radio :label="1">黑名单</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="二维码">
              <el-alert
                title="系统会按 /entry/qr/token 的同样逻辑，基于会员ID自动生成入场二维码 token 并下发给闸机。"
                type="success"
                :closable="false"
                show-icon
              />
            </el-form-item>

            <el-form-item label="生效时间">
              <el-date-picker
                v-model="effectiveTimeValue"
                type="datetime"
                value-format="timestamp"
                placeholder="可选，不填表示立即生效"
                style="width: 100%;"
              />
            </el-form-item>

            <el-form-item label="失效时间">
              <el-date-picker
                v-model="expireTimeValue"
                type="datetime"
                value-format="timestamp"
                placeholder="可选，不填表示按设备默认策略"
                style="width: 100%;"
              />
            </el-form-item>

            <el-form-item label="人脸图片" prop="personPicture">
              <div class="image-picker">
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="image-input"
                  @change="handleFileChange"
                >
                <el-button icon="el-icon-upload2" @click="$refs.fileInput.click()">
                  选择图片
                </el-button>
                <span class="image-tip">支持 JPG、PNG，提交时自动转 base64</span>
              </div>
              <div v-if="imagePreview" class="image-preview-wrap">
                <img :src="imagePreview" alt="face preview" class="image-preview">
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                v-hasPermi="['device:gate:person:config']"
                type="primary"
                icon="el-icon-check"
                :loading="submitting"
                @click="handleSubmit"
              >
                下发人脸配置
              </el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>

          <el-alert
            title="该功能会通过 insertPerson 向闸机下发人员、人脸图片和自动生成的入场二维码 token，设备需保持在线。"
            type="info"
            :closable="false"
            show-icon
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="10" :lg="11">
        <el-card shadow="hover">
          <div slot="header" class="clearfix">
            <span>最近结果</span>
          </div>

          <el-descriptions v-if="lastResult" :column="1" border>
            <el-descriptions-item label="设备 ID">
              {{ lastResult.deviceId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="会员 ID">
              {{ lastResult.memberId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="人员 ID">
              {{ lastResult.personId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="人员姓名">
              {{ lastResult.personName || '-' }}
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

          <el-empty v-else description="尚未执行人脸下发操作" :image-size="90" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog title="选择会员" :visible.sync="memberDialogOpen" width="820px" append-to-body>
      <el-form :model="memberQuery" :inline="true" size="small" class="ry_form">
        <el-form-item label="昵称">
          <el-input
            v-model.trim="memberQuery.nickname"
            placeholder="请输入昵称"
            clearable
            @keyup.enter.native="fetchMemberOptions"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model.trim="memberQuery.phone"
            placeholder="请输入手机号"
            clearable
            @keyup.enter.native="fetchMemberOptions"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="fetchMemberOptions">搜索</el-button>
          <el-button icon="el-icon-refresh" @click="resetMemberQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        v-loading="memberLoading"
        :data="memberOptions"
        border
        height="360"
        @row-dblclick="selectMember"
      >
        <el-table-column label="会员ID" prop="id" width="100" />
        <el-table-column label="昵称" prop="nickname" min-width="180" />
        <el-table-column label="手机号" prop="phoneHidden" min-width="160" />
        <el-table-column label="注册时间" min-width="180">
          <template slot-scope="scope">
            {{ parseTime(scope.row.createTime) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template slot-scope="scope">
            <el-button type="text" size="mini" @click="selectMember(scope.row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div slot="footer" class="dialog-footer">
        <el-button @click="memberDialogOpen = false">取 消</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { insertGatePerson } from '@/api/device/gate'
import { listUmsMember } from '@/api/ums/member'

export default {
  name: 'DeviceGateFace',
  data() {
    return {
      submitting: false,
      memberLoading: false,
      selectedMember: null,
      memberDialogOpen: false,
      memberQuery: {
        nickname: '',
        phone: '',
        pageNum: 1,
        pageSize: 10
      },
      memberOptions: [],
      imagePreview: '',
      effectiveTimeValue: '',
      expireTimeValue: '',
      form: {
        deviceId: '',
        memberId: undefined,
        personName: '',
        personPicture: '',
        subset: 0
      },
      lastResult: null,
      rules: {
        memberId: [
          { required: true, message: '请输入会员ID', trigger: 'blur' }
        ],
        deviceId: [
          { required: true, message: '请输入闸机设备ID', trigger: 'blur' }
        ],
        personPicture: [
          { required: true, message: '请上传人脸图片', trigger: 'change' }
        ]
      }
    }
  },
  methods: {
    openMemberDialog() {
      this.memberDialogOpen = true
      this.fetchMemberOptions()
    },
    fetchMemberOptions() {
      this.memberLoading = true
      listUmsMember({
        nickname: this.memberQuery.nickname || undefined,
        phone: this.memberQuery.phone || undefined
      }, {
        pageNum: this.memberQuery.pageNum,
        pageSize: this.memberQuery.pageSize
      }).then(response => {
        const content = response && response.content ? response.content : []
        this.memberOptions = Array.isArray(content) ? content : []
      }).finally(() => {
        this.memberLoading = false
      })
    },
    selectMember(member) {
      this.selectedMember = member || null
      this.form.memberId = member && member.id ? member.id : undefined
      if (member && member.nickname) {
        this.form.personName = member.nickname
      }
      this.memberDialogOpen = false
      this.$refs.form.clearValidate('memberId')
    },
    resetMemberQuery() {
      this.memberQuery = {
        nickname: '',
        phone: '',
        pageNum: 1,
        pageSize: 10
      }
      this.fetchMemberOptions()
    },
    clearSelectedMember() {
      this.selectedMember = null
      this.memberOptions = []
      this.form.memberId = undefined
      this.form.personName = ''
    },
    handleFileChange(event) {
      const file = event.target.files && event.target.files[0]
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result || ''
        this.imagePreview = result
        this.form.personPicture = result
        this.$refs.form.clearValidate('personPicture')
      }
      reader.readAsDataURL(file)
    },
    handleSubmit() {
      this.$refs.form.validate(valid => {
        if (!valid) {
          return
        }
        this.submitting = true
        insertGatePerson({
          deviceId: this.form.deviceId,
          memberId: this.form.memberId,
          personName: this.form.personName,
          personPicture: this.form.personPicture,
          subset: this.form.subset,
          effectiveTime: this.toUnixSeconds(this.effectiveTimeValue),
          expireTime: this.toUnixSeconds(this.expireTimeValue)
        }).then(response => {
          this.lastResult = response.data
          this.$modal.msgSuccess(response.msg || '下发成功')
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
    handleReset() {
      this.form = {
        deviceId: '',
        memberId: undefined,
        personName: '',
        personPicture: '',
        subset: 0
      }
      this.selectedMember = null
      this.memberDialogOpen = false
      this.memberQuery = {
        nickname: '',
        phone: '',
        pageNum: 1,
        pageSize: 10
      }
      this.memberOptions = []
      this.imagePreview = ''
      this.effectiveTimeValue = ''
      this.expireTimeValue = ''
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
      this.$nextTick(() => {
        this.$refs.form.resetFields()
      })
    },
    toUnixSeconds(value) {
      if (!value && value !== 0) {
        return undefined
      }
      return Math.floor(Number(value) / 1000)
    }
  }
}
</script>

<style scoped>
.gate-form {
  margin-bottom: 20px;
}

.image-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.image-input {
  display: none;
}

.image-tip {
  color: #909399;
  font-size: 12px;
}

.image-preview-wrap {
  margin-top: 12px;
}

.image-preview {
  display: block;
  width: 180px;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
}
</style>
