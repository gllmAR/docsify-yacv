// Fake shared Python worker for e2e: returns one tiny fake GLB.
self.onmessage = event => {
  const data = event.data || {};
  if (data.type === 'init') {
    self.postMessage({ type: 'ready' });
    return;
  }
  if (data.type === 'run') {
    self.postMessage({
      type: 'result',
      id: data.id,
      models: [{ name: 'part', hash: 'fake', data: 'Z2xURmZha2U=' }], // "glTFfake"
    });
  }
};
