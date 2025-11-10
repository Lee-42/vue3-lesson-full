import { ref } from "@vue/reactivity";
import { h } from "./h";
import { isFunction } from "@vue/shared";

export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    options = {
      loader: options,
    };
  }
  const { loader, timeout, errorComponent, delay } = options;
  return {
    setup() {
      const loaded = ref(false);
      const loading = ref(false);
      let Comp = null;
      let error = null;
      loader()
        .then((comp) => {
          Comp = comp;
          loaded.value = true;
        })
        .catch((err) => {
          error.value = err;
        }).finally(() => {
          loading.value = false;
        });

      if (delay) {
        setTimeout(() => {
          loading.value = true;
        }, delay);
      }

      if (timeout) {
        setTimeout(() => {
          error.value = true;
          throw new Error("组件加载失败");
        }, timeout);
      }

      const placeholder = h("div");

      return () => {
        if (loaded.value) {
          return h(Comp);
        } else if (error.value && errorComponent) {
          return h(errorComponent);
        } else if (loading.value) {
          return h("div", "loading~~~~~");
        } else {
          return placeholder;
        }
      };
    },
  };
}
