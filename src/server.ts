import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';

const fetch = createStartHandler({
  handler: defaultStreamHandler,
});

export default {
  fetch,
};
