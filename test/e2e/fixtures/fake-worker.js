// Fake worker for e2e; supports dedicated Worker and SharedWorker.
function handle(data, reply) {
  if (!data) return;
  if (data.type === 'init') {
    reply({ type: 'ready' });
  } else if (data.type === 'run') {
    reply({
      type: 'result',
      id: data.id,
      models: [{ name: 'part', hash: 'fake', data: 'Z2xURmZha2U=' }], // "glTFfake"
    });
  }
}
if (typeof onconnect !== 'undefined') {
  onconnect = event => {
    const port = event.ports[0];
    port.onmessage = message => handle(message.data, reply => port.postMessage(reply));
    port.start();
  };
} else {
  self.onmessage = event => handle(event.data, reply => self.postMessage(reply));
}
