import logger from './logger.js';

const debug = logger('quill:subscriber');

/**
 * Any object with a named constructor can request an event subscription.
 */
interface Source {
  constructor: { name: string };
}

/**
 * A subscription to an event listener with an originating object,
 * an event target, an event type, a handler function for the event,
 * and some optional configuration.
 */
interface Subscription {
  source: Source;
  target: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

const subscribers = new WeakMap<object, Subscriber>();

/**
 * Gets the Subscriber instance bound to the given object.
 * Creates a new one if the binding does not exist yet.
 */
export function findOrCreateSubscriber(object: Source): Subscriber {
  let subscriber = subscribers.get(object);
  if (!subscriber) {
    debug.info(`Creating new Subscriber for ${object.constructor.name}`);
    subscriber = new Subscriber();
    subscribers.set(object, subscriber);
  }
  return subscriber;
}

/**
 * Keeps track of subscriptions to event listeners,
 * to enable future bulk unsubscription.
 */
class Subscriber {
  private subscriptions: Subscription[];

  constructor() {
    this.subscriptions = [];
  }

  /**
   * Get a copy of the current subscriptions.
   */
  getSubscriptions(): Subscription[] {
    return [...this.subscriptions];
  }

  /**
   * Proxy to target.addEventListener()
   */
  on<T extends keyof DocumentEventMap>(
    source: Source,
    target: Document,
    event: T,
    handler: (ev: DocumentEventMap[T]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on<T extends keyof HTMLElementEventMap>(
    source: Source,
    target: HTMLElement,
    event: T,
    handler: (ev: HTMLElementEventMap[T]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on(
    source: Source,
    target: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    target.addEventListener(event, handler, options);
    this.subscriptions.push({ source, target, event, handler, options });
  }

  /**
   * Proxy to target.removeEventListener()
   */
  off(
    target: Element,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    target.removeEventListener(event, handler, options);
    this.subscriptions = this.subscriptions.filter(
      (subscription) =>
        subscription.target !== target ||
        subscription.event !== event ||
        subscription.handler !== handler ||
        subscription.options !== options,
    );
  }

  /**
   * Remove all event subscriptions originated by the given source.
   */
  removeSourceListeners(source: Source) {
    this.subscriptions
      .filter((subscription) => subscription.source === source)
      .forEach(({ target, event, handler, options }) => {
        target.removeEventListener(event, handler, options);
      });
    this.subscriptions = this.subscriptions.filter(
      (subscription) => subscription.source !== source,
    );
  }

  /**
   * Remove all event subscriptions for all sources.
   */
  removeAllListeners() {
    this.subscriptions.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options);
    });
    this.subscriptions = [];
  }
}

export type { Subscriber };
