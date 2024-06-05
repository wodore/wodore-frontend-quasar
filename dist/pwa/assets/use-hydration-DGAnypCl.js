import { s as ref, aG as isRuntimeSsrPreHydration, z as onMounted } from "./index-CAHSu7Ql.js";
function useHydration() {
  const isHydrated = ref(!isRuntimeSsrPreHydration.value);
  if (isHydrated.value === false) {
    onMounted(() => {
      isHydrated.value = true;
    });
  }
  return { isHydrated };
}
export {
  useHydration as u
};
