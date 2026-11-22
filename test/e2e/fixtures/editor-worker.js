// Fake worker that reports which source produced the model.
function handle(data, reply) {
  if (!data) return;
  if (data.type === 'init') {
    reply({ type: 'ready' });
  } else if (data.type === 'run') {
    const edited = String(data.code || '').includes('Edited');
    reply({
      type: 'result',
      id: data.id,
      models: [{ name: edited ? 'edited' : 'part', hash: 'fake', data: 'Z2xURmZha2U=' }],
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
