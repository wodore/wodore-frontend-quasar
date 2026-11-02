/**
 * Accommodation surfaces barrel — ONE lazy chunk for the whole entry
 * (place-registry requirement: one barrel loader per entry). The three
 * components are the existing WdPlaceContent family; they keep their
 * legacy slug props and are adapted by the host (C2) until they are
 * migrated to the target prop.
 */
export { default as detail } from '@components/content/place/WdPlaceContent.vue';
export { default as detailTitle } from '@components/content/place/WdPlaceTitle.vue';
export { default as detailActions } from '@components/content/place/WdPlaceActions.vue';
