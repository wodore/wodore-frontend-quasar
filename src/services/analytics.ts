// src/types/umami.d.ts
interface Umami {
  track(
    event_name: string,
    event_data?: { [key: string]: unknown },
  ): Promise<string> | undefined;
}

declare let umami: Umami | undefined;

// src/utils/umami.ts
export default function track(
  event_name: string,
  event_data?: { [key: string]: unknown },
): Promise<string> | undefined {
  if (typeof umami !== 'undefined') {
    console.debug('track data: "' + event_name + '"', event_data);
    umami.track(event_name, event_data);
  } else {
    console.warn('Umami is not available.');
    return undefined;
  }
}
