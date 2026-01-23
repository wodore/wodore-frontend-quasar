declare module 'vue3-text-clamp' {
  import { DefineComponent } from 'vue';
  import { VNode } from 'vue';

  interface TextClampSlots {
    before?: (props: { toggle: () => void; expand: () => void; collapse: () => void; clamped: boolean; expanded: boolean }) => VNode[];
    after?: (props: { toggle: () => void; expand: () => void; collapse: () => void; clamped: boolean; expanded: boolean }) => VNode[];
  }

  const TextClamp: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>, TextClampSlots>;
  export default TextClamp;
}
