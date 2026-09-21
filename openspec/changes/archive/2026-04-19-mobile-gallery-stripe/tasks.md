## 1. Template restructuring

- [x] 1.1 Add `v-if="isMobile"` / `v-else` branching in the template: mobile branch renders the stripe, desktop branch keeps existing Swiper with fade/thumbs
- [x] 1.2 Add mobile stripe template block using Swiper with `FreeMode`, `Scrollbar`, `Mousewheel` modules and `SwiperSlide` for each image

## 2. Mobile stripe implementation

- [x] 2.1 Add Swiper imports for `FreeMode`, `Scrollbar`, `Mousewheel` modules and their CSS
- [x] 2.2 Configure mobile stripe Swiper: `slidesPerView="auto"`, freeMode, scrollbar (hidden by default), mousewheel, grabCursor
- [x] 2.3 Style stripe slides: 100px height, `width: auto` preserving original aspect ratio, rounded corners, placeholder number while loading, border styling
- [x] 2.4 Add helper function to select the correct orientation URL per image (`urls.portrait` for portrait, `urls.landscape` for landscape) using `is_portrait` flag
- [x] 2.5 Style stripe container: 100px fixed height, subtle scrollbar matching WdWeatherForecast pattern
- [x] 2.6 Add click handler on each image to call `openDialog(index)`

## 3. Attribution and polish

- [x] 3.1 Move attribution badge to appear above the stripe on mobile (not overlaid on a non-existent hero image)
- [x] 3.2 Ensure the mobile stripe container has proper width containment (overflow hidden) to prevent layout overflow in drawer contexts

## 4. Verification

- [x] 4.1 Run `yarn lint` and `npx vue-tsc --noEmit` — fix any errors
- [x] 4.2 Verify desktop view is completely unchanged (no visual regression)
- [x] 4.3 Verify mobile view shows the image stripe with correct scrolling behavior
