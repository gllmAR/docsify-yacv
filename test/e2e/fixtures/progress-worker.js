// Fake worker that exposes the staged progress protocol for e2e.
function handle(data, reply) {
  if (!data) return;
  if (data.type === 'init') {
    reply({
      type: 'progress',
      stage: 'packages',
      label: 'Installing build123d and the CAD kernel…',
      progress: 0.35,
    });
    setTimeout(() => reply({ type: 'ready' }), 700);
  } else if (data.type === 'run') {
    reply({ type: 'progress', stage: 'code', label: 'Running build123d…', progress: 0.8 });
    setTimeout(
      () =>
        reply({
          type: 'result',
          id: data.id,
          models: [{ name: 'part', hash: 'fake', data: 'Z2xURmZha2U=' }],
        }),
      120,
    );
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
