// AudioWorklet do motor: recebe rotação e carga como parâmetros e gera o som com EngineDSP.
import { EngineDSP } from './engine-dsp.js';

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 12000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const { seed = 7, pipeScale = 1, profile = 'i4t' } = options?.processorOptions || {};
    this.dsp = new EngineDSP(sampleRate, seed, { pipeScale, profile });
  }

  process(_inputs, outputs, parameters) {
    const channels = outputs[0];
    this.dsp.setTarget(parameters.rpm[0], parameters.load[0]);
    this.dsp.process(channels[0]);
    for (let i = 1; i < channels.length; i++) channels[i].set(channels[0]);
    return true;
  }
}

registerProcessor('engine', EngineProcessor);
