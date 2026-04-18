<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" label-width="88px">
      <el-form-item label="设备ID" prop="deviceId">
        <el-input
          v-model.trim="queryParams.deviceId"
          placeholder="请输入闸机设备ID"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="店铺名称" prop="storeName">
        <el-input
          v-model.trim="queryParams.storeName"
          placeholder="请输入店铺名称"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item label="店长关键词" prop="managerKeyword">
        <el-input
          v-model.trim="queryParams.managerKeyword"
          placeholder="姓名或手机号"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">搜索</el-button>
        <el-button icon="el-icon-refresh" size="mini" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="storeList">
      <el-table-column label="店铺ID" prop="id" width="80" />
      <el-table-column label="设备ID" prop="deviceId" min-width="180" />
      <el-table-column label="店铺名称" prop="storeName" min-width="180" />
      <el-table-column label="状态" prop="statusText" width="90" />
      <el-table-column label="店长" min-width="180">
        <template slot-scope="scope">
          <div>{{ scope.row.managerNickname || '未分配' }}</div>
          <div class="sub-line">{{ scope.row.managerPhoneHidden || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="最近闸机上报" prop="lastDeviceReportTime" min-width="170" />
      <el-table-column label="备注" prop="remark" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" align="center" width="220" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            v-hasPermi="['ai:store:edit']"
            @click="handleEdit(scope.row)"
          >
            编辑
          </el-button>
          <el-button
            size="mini"
            type="text"
            icon="el-icon-user"
            v-hasPermi="['ai:store:assign']"
            @click="handleAssign(scope.row)"
          >
            分配店长
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="queryParams.pageNum"
      :limit.sync="queryParams.pageSize"
      @pagination="getList"
    />

    <el-dialog title="编辑AI无人店" :visible.sync="editOpen" width="520px" append-to-body>
      <el-form ref="editForm" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="设备ID">
          <el-input v-model="form.deviceId" disabled />
        </el-form-item>
        <el-form-item label="店铺名称" prop="storeName">
          <el-input v-model.trim="form.storeName" placeholder="请输入店铺名称" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model.trim="form.remark" type="textarea" :rows="4" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="editOpen = false">取 消</el-button>
        <el-button type="primary" @click="submitEdit">确 定</el-button>
      </div>
    </el-dialog>

    <el-dialog title="分配店长" :visible.sync="assignOpen" width="760px" append-to-body>
      <el-form :inline="true" size="small" class="assign-filter">
        <el-form-item label="候选搜索">
          <el-input
            v-model.trim="candidateKeyword"
            placeholder="姓名/手机号/openId"
            clearable
            @keyup.enter.native="loadCandidates"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="mini" @click="loadCandidates">搜索</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="candidateLoading" :data="candidateList" @current-change="handleCandidateSelect" highlight-current-row>
        <el-table-column width="55">
          <template slot-scope="scope">
            <el-radio :label="scope.row.memberId" v-model="assignForm.managerMemberId">{{ '' }}</el-radio>
          </template>
        </el-table-column>
        <el-table-column label="会员ID" prop="memberId" width="90" />
        <el-table-column label="昵称" prop="nickname" min-width="120" />
        <el-table-column label="手机号" prop="phoneHidden" min-width="120" />
        <el-table-column label="登录方式" prop="lastLoginType" width="100" />
        <el-table-column label="审核状态" prop="reviewStatusText" width="100" />
        <el-table-column label="最近登录时间" prop="lastLoginTime" min-width="170" />
      </el-table>

      <div slot="footer" class="dialog-footer">
        <el-button @click="assignOpen = false">取 消</el-button>
        <el-button type="primary" @click="submitAssign">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {
  assignStoreManager,
  getAiStore,
  listAiStore,
  listManagerCandidates,
  updateAiStore
} from '@/api/ai/store'

export default {
  name: 'AiStoreIndex',
  data() {
    return {
      loading: false,
      candidateLoading: false,
      editOpen: false,
      assignOpen: false,
      total: 0,
      storeList: [],
      candidateList: [],
      candidateKeyword: '',
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        deviceId: undefined,
        storeName: undefined,
        managerKeyword: undefined
      },
      form: {
        id: undefined,
        deviceId: '',
        storeName: '',
        status: 1,
        remark: ''
      },
      assignForm: {
        storeId: undefined,
        managerMemberId: undefined
      },
      rules: {
        storeName: [
          { required: true, message: '请输入店铺名称', trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.getList()
  },
  methods: {
    getList() {
      this.loading = true
      listAiStore(this.queryParams, {
        pageNum: this.queryParams.pageNum,
        pageSize: this.queryParams.pageSize
      }).then(response => {
        this.storeList = response.content || []
        this.total = response.totalElements || 0
      }).finally(() => {
        this.loading = false
      })
    },
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    handleEdit(row) {
      getAiStore(row.id).then(response => {
        this.form = {
          id: response.id,
          deviceId: response.deviceId,
          storeName: response.storeName,
          status: response.status,
          remark: response.remark
        }
        this.editOpen = true
      })
    },
    submitEdit() {
      this.$refs.editForm.validate(valid => {
        if (!valid) {
          return
        }
        updateAiStore(this.form).then(() => {
          this.$modal.msgSuccess('保存成功')
          this.editOpen = false
          this.getList()
        })
      })
    },
    handleAssign(row) {
      this.assignForm = {
        storeId: row.id,
        managerMemberId: row.managerMemberId
      }
      this.candidateKeyword = ''
      this.assignOpen = true
      this.loadCandidates()
    },
    loadCandidates() {
      this.candidateLoading = true
      listManagerCandidates(this.candidateKeyword).then(response => {
        this.candidateList = response || []
      }).finally(() => {
        this.candidateLoading = false
      })
    },
    handleCandidateSelect(row) {
      if (row) {
        this.assignForm.managerMemberId = row.memberId
      }
    },
    submitAssign() {
      assignStoreManager(this.assignForm).then(() => {
        this.$modal.msgSuccess('分配成功')
        this.assignOpen = false
        this.getList()
      })
    }
  }
}
</script>

<style scoped>
.sub-line {
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.assign-filter {
  margin-bottom: 12px;
}
</style>
