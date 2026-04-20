<template>
  <div class="add-product-wrapper">
    <el-form ref="form" label-width="108px" :model="form" :rules="rules">
      <el-card style="margin: 20px 20px; font-size: 14px">
        <div slot="header">
          <span>基本信息</span>
        </div>
        <el-row>
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入商品名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品编码" prop="outProductId">
              <barcode-input v-model="form.outProductId" placeholder="请输入商品编码" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="品牌" prop="brandId">
              <brand-select v-model="form.brandId" @change="onBrandChange" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="分类" prop="categoryId">
              <product-category-select v-model="form.categoryId" @change="categoryChange" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序" prop="sort">
              <el-input v-model="form.sort" placeholder="请输入排序" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="价格" prop="price">
              <el-input v-model="form.price" placeholder="请输入PRICE" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单位" prop="unit">
              <el-input v-model="form.unit" placeholder="请输入单位" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商品重量" prop="weight">
              <el-input v-model="form.weight" placeholder="商品重量，默认为克" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="上架状态">
              <DictRadio
                v-model="form.publishStatus"
                size="small"
                :radio-data="dict.type.pms_publish_status"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <el-card style="margin: 20px 20px; font-size: 14px">
        <div slot="header">
          <span>产品图片</span>
        </div>
        <el-form-item label="主图" prop="pic">
          <oss-image-upload v-model="form.pic" :limit="1" :enable-camera="true" />
        </el-form-item>
        <el-form-item label="轮播图" prop="albumPics">
          <oss-image-upload v-model="albumPics" :limit="5" :enable-camera="true" />
        </el-form-item>
      </el-card>

      <el-card style="margin: 20px 20px; font-size: 14px">
        <div slot="header">
          <span>产品规格</span>
        </div>
        <el-form-item label="规格类型">
          <div class="sku-wrapper">
            <div class="sku_sorts">
              <div v-for="(s, idx0) in productAttr" :key="s.name" class="sku_sort">
                <div class="label flex-center">
                  <div class="flex-one">
                    <dict-select v-model="s.name" prop-name="sku_sort_list" value-prop="label" />
                  </div><a class="red" @click="deleteSkuSort(idx0)">删除规格类型</a>
                </div>
                <div v-if="s.name" class="values">
                  <div v-for="(it2, idx1) in s.options" :key="idx1" class="value">
                    <el-input :value="it2.name" placeholder="请输入规格名称" @input="changeName(s, idx1, $event)" /><a v-if="idx1 < s.options.length - 1 || (s.options.length === maxOptionNum &amp;&amp; idx1 === 3)" class="red no-break ml8" @click="deleteOption(s, idx1)">删除</a>
                  </div>
                </div>
              </div>
            </div>
            <el-button v-if="productAttr.length < 2" @click="addSkuSort">+添加规格类型</el-button>
          </div>
        </el-form-item>
        <el-form-item label="规格信息">
          <el-button class="mb20" @click="refreshSku()">刷新列表</el-button>
          <el-table :data="form.skuList" :max-height="400">
            <el-table-column v-for="s in skuAttr" :key="s.name" :label="s.name" :prop="s.name" />
            <el-table-column label="展示图片">
              <template #default="{ row }">
                <oss-image-upload v-model="row.pic" class="img-upload-mini" :limit="1" :is-show-tip="false" />
              </template>
            </el-table-column>
            <el-table-column label="销售价格">
              <template #default="{ row,$index }">
                <el-form-item
                  :rules="{ required: true, message: '请填写价格', trigger: 'blur' }"
                  :prop="'skuList['+$index+'].price'"
                >
                  <el-input v-model="row.price" />
                </el-form-item>
              </template>
            </el-table-column>
            <el-table-column label="库存">
              <template #default="{ row }">
                <el-input v-model="row.stock" type="number" />
              </template>
            </el-table-column>
            <el-table-column label="编码">
              <template #default="{ row }">
                <el-form-item>
                  <el-input v-model="row.outSkuId" />
                  <el-input v-show="false" v-model="row.spData" />
                </el-form-item>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-card>
      <el-card style="margin: 20px 20px; font-size: 14px">
        <div slot="header">
          <span>详情页</span>
        </div>
        <el-form-item label="移动端" prop="detailMobileHtml">
          <Editor v-model="form.detailMobileHtml" placeholder="请输入内容" type="url" />
        </el-form-item>
        <el-form-item label="PC端" prop="detailHtml">
          <Editor v-model="form.detailHtml" placeholder="请输入内容" type="url" />
        </el-form-item>

      </el-card>

      <div class="tc">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div>
    </el-form>
  </div>
</template>

<script>
import { addPmsProduct, getPmsProduct, updatePmsProduct } from '@/api/pms/product'
import ProductCategorySelect from '@/views/components/ProductCategorySelect'
import BrandSelect from '@/views/components/BrandSelect'
import BarcodeInput from '@/components/BarcodeInput'

export default {
  name: 'AddProduct',
  dicts: ['pms_publish_status'],
  components: { BrandSelect, ProductCategorySelect, BarcodeInput },
  data() {
    return {
      rules: {
        name: [
          { required: true, message: '请输入商品名称', trigger: 'blur' }
        ],
        weight: [
          { required: true, message: '请填写商品重量', trigger: 'blur' }
        ]
      },
      form: {
        publishStatus: 1,
        sort: 1000
      },
      skuAttr: [],
      albumPics: null,
      productAttr: [
        {
          name: '颜色',
          options: [
            { name: '红' },
            { name: null }
          ]
        }
      ],
      maxOptionNum: 44
    }
  },
  created() {
    const { id } = this.$route.query
    if (id) {
      this.getInfo(id)
    }
  },
  methods: {
    refreshSku() {
      let skus = []
      const skuMap = new Map()
      this.skuAttr = [...this.productAttr]
      if (this.form.skuList) {
        this.form.skuList.forEach(sku => {
          skuMap.set(sku.spData, sku)
        })
      }
      this.productAttr.forEach((attr, index) => {
        const attrSku = []
        attr.options.forEach((option) => {
          if (!option.name) {
            return
          }
          if (index === 0) {
            attrSku.push({ [attr.name]: option.name })
          } else {
            skus.forEach(it3 => {
              attrSku.push({ ...it3, [attr.name]: option.name })
            })
          }
        })
        skus = attrSku
      })
      skus.forEach(it => {
        if (it) {
          it.spData = JSON.stringify(it)
        }
      })
      skus.forEach(it => {
        const sku = skuMap.get(it.spData)
        if (sku) {
          it.outSkuId = sku.outSkuId
          it.price = sku.price
          it.pic = sku.pic
          it.stock = sku.stock
          it.id = sku.id
        } else {
          it.outSkuId = null
          it.price = null
          it.pic = null
          it.stock = null
          it.id = null
        }
      })
      this.form.productAttr = JSON.stringify(this.productAttr)
      this.form.skuList = skus
    },
    categoryChange(value) {
      if (Array.isArray(value)) {
        console.log(value.toString())
        this.form.productCategoryName = value.toString()
      } else {
        this.form.productCategoryName = null
      }
    },
    onBrandChange(value) {
      this.form.brandName = value
    },
    getInfo(id) {
      getPmsProduct(id).then(response => {
        const { albumPics } = response
        if (albumPics) {
          this.albumPics = albumPics.split(',')
        }
        this.form = response
        if (this.form.productAttr) {
          this.productAttr = JSON.parse(this.form.productAttr)
        }
        this.refreshSku()
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate(valid => {
        if (valid) {
          if (this.albumPics) {
            this.form.albumPics = this.albumPics.toString()
          }
          if (this.form.categoryId && Array.isArray(this.form.categoryId)) {
            this.form.categoryId = this.form.categoryId.pop()
          }
          // 商品价格没填时取sku的最低价
          if (!this.form.price) {
            this.form.price = Math.min.apply(Math, this.form.skuList.map(it => it.price))
          }
          if (this.form.id != null) {
            updatePmsProduct(this.form).then(response => {
              this.$modal.msgSuccess('修改成功')
            })
          } else {
            addPmsProduct(this.form).then(response => {
              this.$modal.msgSuccess('新增成功')
            })
          }
          this.cancel()
        } else {
          if (this.form.name) {
            this.$alert('请填写规格价格', '提示', {
              confirmButtonText: '确定'
            })
          } else {
            this.$alert('请填写商品名称', '提示', {
              confirmButtonText: '确定'
            })
          }
        }
      })
    },
    cancel() {
      this.$tab.closeOpenPage({ path: '/pms/product' })
    },
    changeName(s, idx, val) {
      s.options[idx].name = val
      if (s.options.length - 1 !== idx || s.options.length >= this.maxOptionNum) {
        return
      }
      s.options.push({ name: null })
    },
    addSkuSort() {
      this.productAttr.push({
        name: null,
        options: [{ name: null }]
      })
    },
    deleteSkuSort(idx) {
      this.productAttr.splice(idx)
    },
    deleteOption(s, idx) {
      s.options.splice(idx, 1)
    }
  }
}
</script>

<style lang="stylus">
.add-product-wrapper
  padding 12px
  .content
    margin 0 auto
    width 75%
    min-width 800px
  .sku-wrapper
    background-color #f7f8fa
    padding 12px
    .sku_sorts
      .sku_sort
        background-color white
        margin-bottom 12px
        .label
          padding 8px
        .values
          padding 8px 0 0 8px
          border-top 1px solid $border-color
          display flex
          flex-wrap wrap
          .value
            padding 0 32px 8px 0
            width 200px!important
            display flex
            align-items center
  .img-upload-mini .el-upload--picture-card
    width: 48px;
    height: 48px;
    line-height: 57px;
</style>
