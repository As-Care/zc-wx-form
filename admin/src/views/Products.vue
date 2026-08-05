<template>
  <div class="products-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">门窗商品与分类管理</h2>
      <div>
        <a-button type="outline" class="mr-2" @click="openCategoryModal">
          <template #icon><icon-folder /></template>
          管理分类 (短标题/subTitle)
        </a-button>
        <a-button type="primary" @click="openProductModal">
          <template #icon><icon-plus /></template>
          新建门窗商品
        </a-button>
      </div>
    </div>

    <!-- 门窗分类预览线框卡片 -->
    <a-card title="金刚区分类列表 (小程序精简展示)" class="mb-4">
      <a-space wrap size="medium">
        <a-tag v-for="cat in categories" :key="cat.id" color="gold" size="large">
          <strong>{{ cat.name }}</strong> (小程序显示: <span style="color:#D4AF37;">{{ cat.sub_title }}</span>)
        </a-tag>
      </a-space>
    </a-card>

    <!-- 门窗商品数据表格 -->
    <a-table :data="products" :pagination="{ pageSize: 10 }" border>
      <template #columns>
        <a-table-column title="商品名称" data-index="name" :width="240">
          <template #cell="{ record }">
            <strong>{{ record.name }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="所属分类" data-index="category_name" :width="180">
          <template #cell="{ record }">
            <a-tag color="gold">{{ record.category_name }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="基础平米单价" data-index="base_price_sqm" :width="160">
          <template #cell="{ record }">
            <strong style="color: #C5A880; font-size: 16px;">¥ {{ record.base_price_sqm }} / ㎡</strong>
          </template>
        </a-table-column>

        <a-table-column title="起步计费面积" data-index="min_area" :width="140">
          <template #cell="{ record }">
            {{ record.min_area }} ㎡
          </template>
        </a-table-column>

        <a-table-column title="选配项数量" :width="140">
          <template #cell="{ record }">
            <span>{{ record.options_count }} 项加价规则</span>
          </template>
        </a-table-column>

        <a-table-column title="状态" :width="120">
          <template #cell="{ record }">
            <a-tag color="green">已上架</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="160">
          <template #cell="{ record }">
            <a-button type="text" size="small" @click="editProduct(record)">修改价格/配置</a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 新建/修改商品 Modal -->
    <a-modal v-model:visible="modalVisible" title="配置门窗商品与价格规则" @ok="handleSaveProduct">
      <a-form :model="form" layout="vertical">
        <a-form-item label="商品名称">
          <a-input v-model="form.name" placeholder="请输入商品全称" />
        </a-form-item>

        <a-form-item label="所属分类">
          <a-select v-model="form.category_name">
            <a-option v-for="cat in categories" :key="cat.id" :value="cat.name">
              {{ cat.name }} ({{ cat.sub_title }})
            </a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="基础平米单价 (元/㎡)">
          <a-input-number v-model="form.base_price_sqm" placeholder="如 680" />
        </a-form-item>

        <a-form-item label="起步计费面积 (㎡)">
          <a-input-number v-model="form.min_area" placeholder="如 1.5" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 新建/编辑分类 Modal (含 5 字 subTitle 限制) -->
    <a-modal v-model:visible="catModalVisible" title="新建/编辑门窗分类 (小程序金刚区)" @ok="handleSaveCategory">
      <a-form :model="catForm" layout="vertical">
        <a-form-item label="分类完整名称">
          <a-input v-model="catForm.name" placeholder="如：断桥铝系统窗" />
        </a-form-item>

        <a-form-item label="小程序短标题 (subTitle，最多5个字)" help="专门用于微信小程序首页金刚区与标签栏，限制最多5个字">
          <a-input 
            v-model="catForm.sub_title" 
            :max-length="5" 
            show-word-limit 
            placeholder="如：系统断桥窗 (最多5字)" 
          />
        </a-form-item>

        <a-form-item label="分类矢量图标 URL">
          <a-input v-model="catForm.icon_url" placeholder="/images/icons/window.png" />
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';

const modalVisible = ref(false);
const catModalVisible = ref(false);

const categories = ref([
  { id: 'cat_1', name: '断桥铝系统窗', sub_title: '系统断桥窗', icon_url: '/images/icons/window.png' },
  { id: 'cat_2', name: '极窄推拉门/平开门', sub_title: '极窄推拉门', icon_url: '/images/icons/sliding-door.png' },
  { id: 'cat_3', name: '系统封阳台/阳光房', sub_title: '封阳阳光房', icon_url: '/images/icons/sunroom.png' },
  { id: 'cat_4', name: '金刚网纱窗及配件', sub_title: '金刚网纱窗', icon_url: '/images/icons/mesh.png' },
  { id: 'cat_5', name: '幕墙工程系', sub_title: '幕墙工程系', icon_url: '/images/icons/curtain-wall.png' }
]);

const products = ref([
  { id: 'prod_1', name: '展晨108热桥级系统断桥铝窗', category_name: '断桥铝系统窗', base_price_sqm: 680, min_area: 1.5, options_count: 7, is_active: 1 },
  { id: 'prod_2', name: '展晨120超静音三玻两腔系统窗', category_name: '断桥铝系统窗', base_price_sqm: 880, min_area: 1.5, options_count: 5, is_active: 1 },
  { id: 'prod_3', name: '展晨极简16窄边重型推拉门', category_name: '极窄推拉门/平开门', base_price_sqm: 980, min_area: 2.0, options_count: 4, is_active: 1 },
  { id: 'prod_4', name: '展晨极窄联动平开门', category_name: '极窄推拉门/平开门', base_price_sqm: 750, min_area: 1.5, options_count: 3, is_active: 1 },
  { id: 'prod_5', name: '展晨尊享断桥阳光房系统', category_name: '系统封阳台/阳光房', base_price_sqm: 1280, min_area: 3.0, options_count: 6, is_active: 1 }
]);

const form = ref({
  id: '',
  name: '',
  category_name: '断桥铝系统窗',
  base_price_sqm: 680,
  min_area: 1.5
});

const catForm = ref({
  name: '',
  sub_title: '',
  icon_url: '/images/icons/window.png'
});

const openProductModal = () => {
  form.value = { id: '', name: '', category_name: '断桥铝系统窗', base_price_sqm: 680, min_area: 1.5 };
  modalVisible.value = true;
};

const openCategoryModal = () => {
  catForm.value = { name: '', sub_title: '', icon_url: '/images/icons/window.png' };
  catModalVisible.value = true;
};

const editProduct = (record) => {
  form.value = { ...record };
  modalVisible.value = true;
};

const handleSaveProduct = () => {
  if (form.value.id) {
    const p = products.value.find(item => item.id === form.value.id);
    if (p) {
      p.name = form.value.name;
      p.category_name = form.value.category_name;
      p.base_price_sqm = form.value.base_price_sqm;
      p.min_area = form.value.min_area;
    }
  } else {
    products.value.push({
      id: `prod_${Date.now()}`,
      name: form.value.name,
      category_name: form.value.category_name,
      base_price_sqm: form.value.base_price_sqm,
      min_area: form.value.min_area,
      options_count: 3,
      is_active: 1
    });
  }
  Message.success('商品保存成功！');
  modalVisible.value = false;
};

const handleSaveCategory = () => {
  if (!catForm.value.sub_title || catForm.value.sub_title.length > 5) {
    Message.error('短标题 subTitle 必须在 1-5 个字以内！');
    return;
  }
  categories.value.push({
    id: `cat_${Date.now()}`,
    name: catForm.value.name,
    sub_title: catForm.value.sub_title,
    icon_url: catForm.value.icon_url
  });
  Message.success(`分类 [${catForm.value.name}] 创建成功！短标题: ${catForm.value.sub_title}`);
  catModalVisible.value = false;
};
</script>

<style scoped>
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
</style>
