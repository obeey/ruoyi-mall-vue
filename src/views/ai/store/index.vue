<template>
  <div class="app-container">
    <el-form ref="queryForm" :model="queryParams" size="small" :inline="true" label-width="88px">
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
      <el-table-column label="货柜布局" min-width="180">
        <template slot-scope="scope">
          <div>{{ layoutText(scope.row.layoutSummary, 'shelfCount', '货架') }}</div>
          <div class="sub-line">{{ layoutText(scope.row.layoutSummary, 'totalBoxes', '格口') }}</div>
        </template>
      </el-table-column>
      <el-table-column label="店长" min-width="180">
        <template slot-scope="scope">
          <div>{{ scope.row.managerNickname || '未分配' }}</div>
          <div class="sub-line">{{ scope.row.managerPhoneHidden || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="最近闸机上报" prop="lastDeviceReportTime" min-width="170" />
      <el-table-column label="备注" prop="remark" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" align="center" width="280" class-name="small-padding fixed-width">
        <template slot-scope="scope">
          <el-button
            v-hasPermi="['ai:store:edit']"
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleEdit(scope.row)"
          >
            编辑
          </el-button>
          <el-button
            v-hasPermi="['ai:store:edit']"
            size="mini"
            type="text"
            icon="el-icon-s-grid"
            @click="handleLayout(scope.row)"
          >
            货柜布局
          </el-button>
          <el-button
            v-hasPermi="['ai:store:assign']"
            size="mini"
            type="text"
            icon="el-icon-user"
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

    <el-dialog title="编辑货柜布局" :visible.sync="layoutOpen" width="1100px" append-to-body top="4vh">
      <div v-loading="layoutLoading">
        <div class="layout-head">
          <div>
            <div class="layout-title">{{ layoutForm.storeName || '未命名店铺' }}</div>
            <div class="sub-line">{{ layoutForm.deviceId || '' }}</div>
          </div>
          <div class="layout-summary">
            <el-tag size="small" effect="plain">{{ layoutSummaryText('shelfCount', '货架') }}</el-tag>
            <el-tag size="small" effect="plain">{{ layoutSummaryText('totalLayers', '层') }}</el-tag>
            <el-tag size="small" effect="plain">{{ layoutSummaryText('totalBoxes', '格口') }}</el-tag>
          </div>
        </div>

        <div class="layout-actions">
          <el-button size="mini" type="primary" plain icon="el-icon-plus" @click="addShelf">新增货架</el-button>
        </div>

        <div v-if="layoutForm.shelves.length" class="layout-editor">
          <div v-for="(shelf, shelfIndex) in layoutForm.shelves" :key="shelf.localKey" class="shelf-card">
            <div class="shelf-header">
              <div class="shelf-title">
                <el-input v-model.trim="shelf.shelfName" size="mini" placeholder="货架名称" />
                <el-input v-model.trim="shelf.weighIp" size="mini" placeholder="称重IP，如 192.168.1.131" />
                <span class="sub-line">共 {{ shelf.layers.length }} 层 / {{ shelfBoxCount(shelf) }} 个格口</span>
              </div>
              <div>
                <el-button size="mini" type="text" icon="el-icon-plus" @click="addLayer(shelf)">增加层</el-button>
                <el-button
                  size="mini"
                  type="text"
                  icon="el-icon-delete"
                  class="danger-text"
                  @click="removeShelf(shelfIndex)"
                >
                  删除货架
                </el-button>
              </div>
            </div>

            <div v-for="(layer, layerIndex) in shelf.layers" :key="layer.localKey" class="layer-row">
              <div class="layer-meta">
                <span class="layer-name">第 {{ layerIndex + 1 }} 层</span>
                <el-input-number
                  v-model="layer.boxCount"
                  size="mini"
                  :min="1"
                  :max="20"
                  @change="syncLayoutSummary"
                />
                <el-button
                  size="mini"
                  type="text"
                  class="danger-text"
                  @click="removeLayer(shelf, layerIndex)"
                >
                  删除本层
                </el-button>
              </div>
              <div class="box-preview">
                <div v-for="boxNo in layer.boxCount" :key="boxNo" class="box-cell">
                  {{ shelfIndex + 1 }}-{{ layerIndex + 1 }}-{{ boxNo }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="当前还没有货架，请先新增货架" :image-size="90" />
      </div>

      <div slot="footer" class="dialog-footer">
        <el-button @click="layoutOpen = false">取 消</el-button>
        <el-button type="primary" @click="submitLayout">保 存 布 局</el-button>
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

      <el-table v-loading="candidateLoading" :data="candidateList" highlight-current-row @current-change="handleCandidateSelect">
        <el-table-column width="55">
          <template slot-scope="scope">
            <el-radio v-model="assignForm.managerMemberId" :label="scope.row.memberId">{{ '' }}</el-radio>
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
  getAiStoreLayout,
  listAiStore,
  listManagerCandidates,
  updateAiStore,
  updateAiStoreLayout
} from '@/api/ai/store'

let layoutSeed = 1

export default {
  name: 'AiStoreIndex',
  data() {
    return {
      loading: false,
      candidateLoading: false,
      layoutLoading: false,
      editOpen: false,
      layoutOpen: false,
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
      layoutForm: {
        storeId: undefined,
        storeName: '',
        deviceId: '',
        shelves: [],
        summary: {}
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
    nextLayoutKey(prefix) {
      layoutSeed += 1
      return `${prefix}-${layoutSeed}`
    },
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
    layoutText(summary, key, suffix) {
      const value = summary && summary[key] !== undefined ? summary[key] : 0
      return `${value} ${suffix}`
    },
    layoutSummaryText(key, suffix) {
      return this.layoutText(this.layoutForm.summary, key, suffix)
    },
    shelfBoxCount(shelf) {
      return (shelf.layers || []).reduce((total, layer) => total + Number(layer.boxCount || 0), 0)
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
    handleLayout(row) {
      this.layoutLoading = true
      getAiStoreLayout(row.id).then(response => {
        const layoutConfig = response.layoutConfig || {}
        const shelves = (layoutConfig.shelves || []).map((shelf, shelfIndex) => ({
          localKey: this.nextLayoutKey('shelf'),
          shelfName: shelf.shelfName || `${shelfIndex + 1}号货架`,
          weighIp: shelf.weighIp || '',
          layers: (shelf.layers || []).map((layer) => ({
            localKey: this.nextLayoutKey('layer'),
            boxCount: Number(layer.boxCount || 1)
          }))
        }))
        this.layoutForm = {
          storeId: response.storeId,
          storeName: response.storeName,
          deviceId: response.deviceId,
          shelves: shelves.length ? shelves : [this.createShelf()],
          summary: response.layoutSummary || {}
        }
        this.syncLayoutSummary()
        this.layoutOpen = true
      }).finally(() => {
        this.layoutLoading = false
      })
    },
    createLayer(boxCount = 4) {
      return {
        localKey: this.nextLayoutKey('layer'),
        boxCount
      }
    },
    createShelf() {
      return {
        localKey: this.nextLayoutKey('shelf'),
        shelfName: `${(this.layoutForm.shelves || []).length + 1}号货架`,
        weighIp: '',
        layers: [this.createLayer(), this.createLayer(), this.createLayer()]
      }
    },
    addShelf() {
      this.layoutForm.shelves.push(this.createShelf())
      this.syncLayoutSummary()
    },
    removeShelf(index) {
      this.layoutForm.shelves.splice(index, 1)
      if (!this.layoutForm.shelves.length) {
        this.layoutForm.shelves.push(this.createShelf())
      }
      this.syncLayoutSummary()
    },
    addLayer(shelf) {
      shelf.layers.push(this.createLayer())
      this.syncLayoutSummary()
    },
    removeLayer(shelf, layerIndex) {
      shelf.layers.splice(layerIndex, 1)
      if (!shelf.layers.length) {
        shelf.layers.push(this.createLayer())
      }
      this.syncLayoutSummary()
    },
    syncLayoutSummary() {
      let totalLayers = 0
      let totalBoxes = 0
      this.layoutForm.shelves.forEach(shelf => {
        totalLayers += shelf.layers.length
        totalBoxes += this.shelfBoxCount(shelf)
      })
      this.layoutForm.summary = {
        shelfCount: this.layoutForm.shelves.length,
        totalLayers,
        totalBoxes
      }
    },
    submitLayout() {
      const shelves = this.layoutForm.shelves.map((shelf, shelfIndex) => ({
        shelfNo: shelfIndex + 1,
        shelfName: shelf.shelfName || `${shelfIndex + 1}号货架`,
        weighIp: shelf.weighIp || '',
        layers: shelf.layers.map((layer, layerIndex) => ({
          layerNo: layerIndex + 1,
          boxCount: Number(layer.boxCount || 1)
        }))
      }))
      updateAiStoreLayout(this.layoutForm.storeId, {
        layoutConfig: {
          shelves
        }
      }).then(() => {
        this.$modal.msgSuccess('货柜布局已保存')
        this.layoutOpen = false
        this.getList()
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

.layout-head,
.shelf-header,
.layer-meta,
.layout-summary {
  display: flex;
  align-items: center;
}

.layout-head,
.shelf-header {
  justify-content: space-between;
}

.layout-head {
  margin-bottom: 16px;
}

.layout-title {
  font-size: 16px;
  font-weight: 600;
}

.layout-summary {
  gap: 8px;
}

.layout-actions {
  margin-bottom: 12px;
}

.layout-editor {
  max-height: 64vh;
  overflow-y: auto;
  padding-right: 8px;
}

.shelf-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
}

.shelf-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shelf-title .el-input {
  width: 180px;
}

.layer-row {
  padding: 14px 0;
  border-top: 1px dashed #ebeef5;
}

.layer-meta {
  gap: 12px;
  margin-bottom: 12px;
}

.layer-name {
  min-width: 60px;
  color: #303133;
  font-weight: 500;
}

.box-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px;
}

.box-cell {
  height: 56px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  color: #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.danger-text {
  color: #f56c6c;
}
</style>
