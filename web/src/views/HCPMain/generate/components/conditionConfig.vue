<template>
  <h-collapse
    title="Condition Config"
    showSwitch
    v-model="isOpenConditionConfig"
    @onSwitch="handleSwitchMergeConfig"
  >
    <HBlock>
      <div class="config-row" v-if="config">
        <HConfigSelect label="type" :options="type_options" v-model="config.type" />
      </div>
      <div class="config-row" v-if="config">
        <HConfigInput label="image" required v-model="config.image" type="file" />
      </div>
    </HBlock>
  </h-collapse>
</template>
<script>
import { default_data, type_options } from '@/constants/index';
export default {
  name: 'ConditionConfig',
  props: {
    params: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      type_options,
      isOpenConditionConfig: false,

      // 备份 params.condition
      cacheConfig: JSON.parse(JSON.stringify(default_data.condition)),

      config: null
    };
  },
  watch: {
    isOpenConditionConfig: {
      handler: function (val) {
        if (val) {
          this.config = JSON.parse(JSON.stringify(this.cacheConfig));
          if (!this.params.condition && !this.config) {
            this.config = JSON.parse(JSON.stringify(default_data.condition));
          }
        } else {
          // 备份
          this.cacheConfig = JSON.parse(JSON.stringify(this.config));
          this.config = null;
        }
      },
      immediate: true
    },
    config: {
      handler: function (value) {
        this.$emit('updateConfig', {
          field: 'condition',
          value: JSON.parse(JSON.stringify(value))
        });
      },
      deep: true
    }
  },
  created() {
    this.cacheConfig = JSON.parse(JSON.stringify(default_data.condition));
  },
  methods: {
    initConfig(info) {
      const condition = JSON.parse(JSON.stringify(info.condition));
      this.$set(this, 'config', condition);
      this.isOpenConditionConfig = !!this.config;
      // 为了解决切换状态时，config 会被重置的问题
      setTimeout(() => {
        if (this.isOpenConditionConfig && (!!this.config || !this.config)) {
          this.config = JSON.parse(JSON.stringify(info.condition || default_data.condition));
        }
      }, 300);
    },
    getConfig() {
      return this.config;
    },
    handleSwitchMergeConfig(val) {
      this.$emit('onOpen', val);
    }
  }
};
</script>
<style lang=""></style>
