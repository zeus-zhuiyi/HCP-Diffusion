const SHELL = {
  TRAIN: {
    MODE: {
      ACCELERATE: 0,
      ACCELERATE_AND_ONLY_ONE_GPU: 1,
      COLOSSAL_AI: 2
    }
  },
  STATUS: {
    BEGIN: 0,
    LOADING: 1,
    END: 2,
    ACTIVE_INTERRUPT: 3,
    UNACTIVE_INTERRUPT: 4,
    DELETE_OR_NOT_EXIST: 5
  }
};

const SHELL_LOG_TAG = {
  BEGIN_TIPS: 'this shell process is running:', // 正常开始
  END_TIPS: 'this shell process had finished', // 正常结束
  ACTIVE_INTERRUPT_END_TIPS: 'this shell process had been active interrupted', // 手动打断
  UNACTIVE_INTERRUPT_END_TIPS: 'this shell process had been unactive interrupted', // 意外打断
  GENERATE_PROGRESS_TIPS: 'this progress steps:', // 生成的进度标记
  TRAIN_PROGRESS_TIPS: 'Step = [', // 训练的进度标记
  IMAGES_PATH_TIPS: 'this images output path:'
};

// 初始化时需要将会生成文件的那部分目录先创建好
const DIR = {
  GENERATE: {
    OUT_DIR: 'output/',
    EMB_DIR: 'embs/',
    YAML_FILE: 'cfgs/infer',
    PRETRAINED_MODE: 'models/stable-diffusion',
    CONDITION_IMAGE: 'condition_images',
    MERGE_GROUP_LORA_PATH: 'ckpts/lora_models',
    MERGE_GROUP_PART_PATH: 'ckpts',
    MERGE_GROUP_PLUGIN_CONTROLNET1_PATH: 'ckpts'
  },
  TRAIN: {
    YAML_FILE: 'cfgs/train',
    PROMPT_TEMPLATE_DIR: 'prompt_tuning_template',
    EMB_DIR: 'embs/',
    PROMPT_FILE_DIR: 'prompt_datasets',
  },
  HOST: {
    UPLOAD: 'condition_images'
    // UPLOAD: 'uploads'
  },
  WEB: {
    DIST: 'dist'
  },
  SERVER: {
    YAML_FILE: 'public/yaml',
    SHELL_LOG: 'logs/shell',
    STATIC_SOURCE: {
      IMAGE: '/static/imgs'
    }
  }
};

// TODO: 对齐格式范围
const PATH = {
  pretrained_mode: {
    dirPath: DIR.GENERATE.PRETRAINED_MODE,
    fileTypes: ['.ckpt', '.safetensors']
  },
  pretrained_model_name_or_path: {
    dirPath: DIR.GENERATE.PRETRAINED_MODE,
    fileTypes: ['.ckpt', '.safetensors']
  },
  out_dir: {
    dirPath: DIR.GENERATE.OUT_DIR,
    fileTypes: ['.jpg', '.jpeg', '.png']
  },
  emb_dir: {
    dirPath: DIR.GENERATE.EMB_DIR,
    fileTypes: ['.pt']
  },
  condition_image: {
    dirPath: DIR.GENERATE.CONDITION_IMAGE,
    fileTypes: ['.jpg', '.jpeg', '.png']
  },
  merge_group_lora_path: {
    dirPath: DIR.GENERATE.MERGE_GROUP_LORA_PATH,
    fileTypes: ['.ckpt', '.safetensors']
  },
  merge_group_part_path: {
    dirPath: DIR.GENERATE.MERGE_GROUP_PART_PATH,
    fileTypes: ['.ckpt', '.safetensors']
  },
  merge_group_plugin_controlnet1_path: {
    dirPath: DIR.GENERATE.MERGE_GROUP_PLUGIN_CONTROLNET1_PATH,
    fileTypes: ['.ckpt', '.safetensors']
  },
  tokenizer_pt_train_name: {
    dropSuffix: true,
    dirPath: DIR.TRAIN.EMB_DIR,
    fileTypes: ['.pt']
  },
  prompt_template: {
    dirPath: DIR.TRAIN.PROMPT_TEMPLATE_DIR,
    fileTypes: ['.txt']
  },
  prompt_file: {
    dirPath: DIR.TRAIN.PROMPT_FILE_DIR,
    fileTypes: ['.parquet']
  },
  server_yaml_file: {
    dropSuffix: true,
    dirPath: DIR.SERVER.YAML_FILE,
    fileTypes: ['.yaml', 'yml']
  }
};

const APP_DATA = {
  BUILT_IN_MODEL: [{
    label: 'stable-diffusion-v1-5',
    value: 'runwayml/stable-diffusion-v1-5'
  }]
};

module.exports = {
  SHELL_LOG_TAG,
  SHELL,
  DIR,
  PATH,
  APP_DATA
};
