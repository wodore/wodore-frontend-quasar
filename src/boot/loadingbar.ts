import { LoadingBar } from 'quasar';

export default async () => {
  LoadingBar.setDefaults({
    hijackFilter: (url: string) => {
      // return false to skip loading bar for this URL
      console.debug('LoadingBar hijackFilter:', url);
      if (
        /^.*timetable.search.ch.*/.test(url) ||
        /^.*m\/hut\/*/.test(url) ||
        /\/geo\/places\/search/.test(url)
      ) {
        console.debug('  Skipping LoadingBar for:', url);
        return false;
      }
      return true;
    },
  });
};
