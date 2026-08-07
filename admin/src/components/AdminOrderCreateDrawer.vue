<template>
  <a-drawer
    :visible="visible"
    :width="920"
    title="后台创建客户订单"
    unmount-on-close
    @update:visible="(value) => emit('update:visible', value)"
  >
    <a-spin :loading="loading" style="width: 100%">
      <section class="form-section">
        <h3>客户与安装信息</h3>
        <a-form :model="form" layout="vertical">
          <a-form-item label="绑定客户" required>
            <a-select
              v-model="form.user_id"
              placeholder="请选择客户"
              allow-search
              :filter-option="filterCustomer"
              @change="handleCustomerChange"
            >
              <a-option
                v-for="customer in customers"
                :key="customer.id"
                :value="customer.id"
                :label="`${customer.nickname}（${customer.phone}）`"
              >
                {{ customer.nickname }}（{{ customer.phone }}）
              </a-option>
            </a-select>
          </a-form-item>

          <a-grid :cols="2" :col-gap="16">
            <a-grid-item>
              <a-form-item label="联系人姓名" required>
                <a-input v-model="form.customer_name" />
              </a-form-item>
            </a-grid-item>
            <a-grid-item>
              <a-form-item label="联系电话" required>
                <a-input v-model="form.customer_phone" />
              </a-form-item>
            </a-grid-item>
          </a-grid>

          <a-form-item v-if="addresses.length" label="客户已保存地址">
            <a-select
              v-model="selectedAddressId"
              placeholder="请选择地址"
              @change="handleAddressChange"
            >
              <a-option
                v-for="address in addresses"
                :key="address.id"
                :value="address.id"
              >
                {{ address.is_default ? "【默认】" : ""
                }}{{ formatAddress(address) }}
              </a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="安装详细地址" required>
            <a-textarea
              v-model="form.install_address"
              :placeholder="
                addresses.length
                  ? '可选择已有地址，也可以手动修改'
                  : '该客户没有默认地址，请管理员填写安装详细地址'
              "
              :auto-size="{ minRows: 2, maxRows: 4 }"
            />
          </a-form-item>
        </a-form>
      </section>

      <a-divider />

      <section class="form-section">
        <h3>商品与定制配置</h3>
        <a-form layout="vertical">
          <a-form-item label="门窗商品" required>
            <a-select
              v-model="form.product_id"
              placeholder="请选择商品"
              allow-search
              @change="handleProductChange"
            >
              <a-option
                v-for="product in products"
                :key="product.id"
                :value="product.id"
              >
                {{ product.name }}（¥{{ product.base_price_sqm }}/㎡）
              </a-option>
            </a-select>
          </a-form-item>
        </a-form>

        <div v-if="productDetail" class="product-summary">
          <strong>{{ productDetail.name }}</strong>
          <span>基础价 ¥{{ productDetail.base_price_sqm }}/㎡</span>
          <span>起步 {{ productDetail.min_area || 1 }}㎡/套</span>
        </div>

        <div
          v-for="(set, setIndex) in customSets"
          :key="set.id"
          class="set-panel"
        >
          <div class="set-header">
            <strong>配置 {{ setIndex + 1 }}</strong>
            <a-button
              v-if="customSets.length > 1"
              type="text"
              status="danger"
              size="small"
              @click="removeSet(setIndex)"
            >
              <template #icon><icon-delete /></template>
              删除
            </a-button>
          </div>

          <a-grid :cols="3" :col-gap="12">
            <a-grid-item>
              <a-form-item label="套系名称" required>
                <a-input v-model="set.label" placeholder="如：客厅窗1" />
              </a-form-item>
            </a-grid-item>
            <a-grid-item>
              <a-form-item label="宽度（mm）" required>
                <a-input-number
                  v-model="set.width_mm"
                  :min="1"
                  :precision="0"
                  style="width: 100%"
                />
              </a-form-item>
            </a-grid-item>
            <a-grid-item>
              <a-form-item label="高度（mm）" required>
                <a-input-number
                  v-model="set.height_mm"
                  :min="1"
                  :precision="0"
                  style="width: 100%"
                />
              </a-form-item>
            </a-grid-item>
          </a-grid>

          <a-form-item
            v-for="group in productDetail.optionGroups || []"
            :key="group.group_name"
            :label="group.groupTitle"
          >
            <a-radio-group v-model="set.selected_options[group.group_name]">
              <a-radio
                v-for="option in group.options"
                :key="option.id"
                :value="option.id"
              >
                {{ option.option_name
                }}<span class="option-price">{{ option.priceText }}</span>
              </a-radio>
            </a-radio-group>
          </a-form-item>

          <a-form-item label="现场备注">
            <a-textarea
              v-model="set.customer_remark"
              placeholder="测量、安装环境或客户要求"
              :auto-size="{ minRows: 2, maxRows: 3 }"
            />
          </a-form-item>

          <a-form-item label="现场照片（最多6张）">
            <a-upload
              action="https://zc-api.carelife.top/api/upload"
              list-type="picture-card"
              :limit="6"
              :show-file-list="true"
              @success="(fileItem) => handleSceneUpload(setIndex, fileItem)"
            />
          </a-form-item>

          <div class="set-price">
            计费面积 {{ calculateSet(set).billedArea.toFixed(2) }}㎡，小计
            <strong>¥{{ calculateSet(set).totalPrice.toFixed(2) }}</strong>
          </div>
        </div>

        <a-button v-if="productDetail" type="outline" long @click="addSet">
          <template #icon><icon-plus /></template>
          增加一套配置
        </a-button>
      </section>

      <a-divider />

      <section class="form-section">
        <h3>订单状态与备注</h3>
        <a-grid :cols="2" :col-gap="16">
          <a-grid-item>
            <a-form-item label="初始状态" required>
              <a-select v-model="form.status">
                <a-option value="pending_review">待复核</a-option>
                <a-option value="producing">生产中</a-option>
                <a-option value="installing">待提货</a-option>
                <a-option value="completed">已完成</a-option>
                <a-option value="cancelled">已取消</a-option>
              </a-select>
            </a-form-item>
          </a-grid-item>
          <a-grid-item>
            <div class="total-price">
              预估总金额 <strong>¥{{ totalPrice.toFixed(2) }}</strong>
            </div>
          </a-grid-item>
        </a-grid>
        <a-form-item label="后台备注">
          <a-textarea
            v-model="form.admin_remark"
            placeholder="仅后台查看的订单备注"
            :auto-size="{ minRows: 2, maxRows: 4 }"
          />
        </a-form-item>
      </section>
    </a-spin>

    <template #footer>
      <a-space>
        <a-button @click="emit('update:visible', false)">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="submitOrder"
          >创建订单</a-button
        >
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";

const props = defineProps({ visible: { type: Boolean, default: false } });
const emit = defineEmits(["update:visible", "created"]);
const API_BASE = "https://zc-api.carelife.top";

const loading = ref(false);
const submitting = ref(false);
const customers = ref([]);
const products = ref([]);
const addresses = ref([]);
const selectedAddressId = ref("");
const productDetail = ref(null);
const customSets = ref([]);
const form = ref({
  user_id: "",
  customer_name: "",
  customer_phone: "",
  install_address: "",
  product_id: "",
  status: "pending_review",
  admin_remark: "",
});

const resetForm = () => {
  form.value = {
    user_id: "",
    customer_name: "",
    customer_phone: "",
    install_address: "",
    product_id: "",
    status: "pending_review",
    admin_remark: "",
  };
  addresses.value = [];
  selectedAddressId.value = "";
  productDetail.value = null;
  customSets.value = [];
};

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return;
    resetForm();
    loading.value = true;
    try {
      const [customerRes, productRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`).then((res) => res.json()),
        fetch(`${API_BASE}/api/products`).then((res) => res.json()),
      ]);
      customers.value = customerRes.success ? customerRes.data || [] : [];
      products.value = productRes.success ? productRes.data || [] : [];
    } catch (e) {
      Message.error("客户或商品数据加载失败");
    } finally {
      loading.value = false;
    }
  },
);

const filterCustomer = (input, option) =>
  String(option.label || option.value || "")
    .toLowerCase()
    .includes(input.toLowerCase());
const formatAddress = (address) =>
  `${address.province || ""}${address.city || ""}${address.district || ""}${address.detail_address || ""}`;

const handleCustomerChange = async (userId) => {
  const customer = customers.value.find((item) => item.id === userId);
  if (!customer) return;
  form.value.customer_name = customer.nickname || "";
  form.value.customer_phone = customer.phone || "";
  form.value.install_address = "";
  selectedAddressId.value = "";
  try {
    const res = await fetch(
      `${API_BASE}/api/user/addresses?user_id=${encodeURIComponent(userId)}`,
    );
    const data = await res.json();
    addresses.value = data.success ? data.data || [] : [];
    const defaultAddress =
      addresses.value.find((item) => Number(item.is_default) === 1) ||
      addresses.value[0];
    if (defaultAddress) {
      selectedAddressId.value = defaultAddress.id;
      form.value.install_address = formatAddress(defaultAddress);
      form.value.customer_name =
        defaultAddress.name || form.value.customer_name;
      form.value.customer_phone =
        defaultAddress.phone || form.value.customer_phone;
    }
  } catch (e) {
    addresses.value = [];
  }
};

const handleAddressChange = (addressId) => {
  const address = addresses.value.find((item) => item.id === addressId);
  if (!address) return;
  form.value.install_address = formatAddress(address);
  form.value.customer_name = address.name || form.value.customer_name;
  form.value.customer_phone = address.phone || form.value.customer_phone;
};

const createSet = (index) => {
  const selectedOptions = {};
  (productDetail.value.optionGroups || []).forEach((group) => {
    const defaultOption =
      group.options.find((option) => Number(option.is_default) === 1) ||
      group.options[0];
    if (defaultOption) selectedOptions[group.group_name] = defaultOption.id;
  });
  return {
    id: `admin_set_${Date.now()}_${index}`,
    label: `${form.value.customer_name || "客户"}-${index}`,
    width_mm: Number(productDetail.value.default_width || 2400),
    height_mm: Number(productDetail.value.default_height || 2100),
    selected_options: selectedOptions,
    customer_remark: "",
    scene_images: [],
  };
};

const handleProductChange = async (productId) => {
  loading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/products/${productId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "商品加载失败");
    productDetail.value = data.data;
    customSets.value = [createSet(1)];
  } catch (e) {
    productDetail.value = null;
    customSets.value = [];
    Message.error(e.message || "商品配置加载失败");
  } finally {
    loading.value = false;
  }
};

const addSet = () =>
  customSets.value.push(createSet(customSets.value.length + 1));
const removeSet = (index) => customSets.value.splice(index, 1);

const getSelectedOptions = (set) => {
  if (!productDetail.value) return [];
  return (productDetail.value.optionGroups || [])
    .map((group) => {
      const selectedId = set.selected_options[group.group_name];
      const option =
        group.options.find((item) => item.id === selectedId) ||
        group.options[0];
      return option
        ? {
            ...option,
            group_name: group.group_name,
            groupTitle: group.groupTitle,
          }
        : null;
    })
    .filter(Boolean);
};

const calculateSet = (set) => {
  if (!productDetail.value) return { billedArea: 0, totalPrice: 0 };
  const actualArea =
    (Number(set.width_mm || 0) * Number(set.height_mm || 0)) / 1000000;
  const billedArea = Math.max(
    actualArea,
    Number(productDetail.value.min_area || 1),
  );
  let totalPrice = billedArea * Number(productDetail.value.base_price_sqm || 0);
  getSelectedOptions(set).forEach((option) => {
    const price = Number(option.price || 0);
    if (option.price_type === "per_sqm") totalPrice += billedArea * price;
    else totalPrice += price;
  });
  return { billedArea, totalPrice };
};

const totalPrice = computed(() =>
  customSets.value.reduce((sum, set) => sum + calculateSet(set).totalPrice, 0),
);

const handleSceneUpload = (setIndex, fileItem) => {
  const url = fileItem?.response?.url || fileItem?.url;
  if (
    url &&
    customSets.value[setIndex] &&
    !customSets.value[setIndex].scene_images.includes(url)
  ) {
    customSets.value[setIndex].scene_images.push(url);
  }
};

const validate = () => {
  if (!form.value.user_id) return "请选择客户";
  if (!form.value.customer_name.trim()) return "请填写联系人姓名";
  if (!/^1[3-9]\d{9}$/.test(form.value.customer_phone.trim()))
    return "请填写有效联系电话";
  if (!form.value.install_address.trim()) return "请填写安装详细地址";
  if (!productDetail.value || !customSets.value.length)
    return "请选择商品并填写配置";
  for (let index = 0; index < customSets.value.length; index += 1) {
    const set = customSets.value[index];
    if (!set.label.trim()) return `请填写配置 ${index + 1} 的套系名称`;
    if (Number(set.width_mm) <= 0 || Number(set.height_mm) <= 0)
      return `请填写配置 ${index + 1} 的有效宽高`;
  }
  return "";
};

const submitOrder = async () => {
  const error = validate();
  if (error) return Message.warning(error);
  submitting.value = true;
  try {
    const adminUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
    const sets = customSets.value.map((set) => ({
      ...set,
      selectedOptionsSummary: getSelectedOptions(set).map((option) => ({
        id: option.id,
        group_name: option.group_name,
        groupTitle: option.groupTitle,
        option_name: option.option_name,
        price_type: option.price_type,
        price: option.price,
        priceText: option.priceText,
        image_url: option.image_url || "",
      })),
    }));
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form.value,
        product_name: productDetail.value.name,
        base_price_sqm: productDetail.value.base_price_sqm,
        min_area: productDetail.value.min_area,
        customSets: sets,
        customer_remark: sets
          .map((set) => set.customer_remark)
          .filter(Boolean)
          .join("；"),
        scene_images: sets.flatMap((set) => set.scene_images).join(","),
        creator_type: "admin",
        creator_id: adminUser.id || "",
        creator_name: adminUser.username || adminUser.nickname || "管理员",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.message || `创建失败 (HTTP ${res.status})`);
    Message.success(`订单 ${data.order_no} 创建成功`);
    emit("created");
    emit("update:visible", false);
  } catch (e) {
    Message.error(e.message || "订单创建失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.form-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
}
.product-summary {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 12px 0;
  color: var(--color-text-2);
}
.set-panel {
  padding: 16px 0;
  border-top: 1px solid var(--color-border-2);
}
.set-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.option-price {
  margin-left: 6px;
  color: #b89768;
  font-size: 12px;
}
.set-price {
  text-align: right;
  color: var(--color-text-2);
}
.set-price strong {
  margin-left: 8px;
  color: #b89768;
  font-size: 17px;
}
.total-price {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  color: var(--color-text-2);
}
.total-price strong {
  color: #b89768;
  font-size: 22px;
}
</style>
