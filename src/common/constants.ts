export class ExposeVerbs {
  static readonly HANDLER = 'handler';
  static readonly SUBSCRIBER = 'subscriber';
  static readonly SENDER = 'sender';

  static readonly SCHEME_SET = new Set([this.HANDLER, this.SUBSCRIBER, this.SENDER]);

  static isValid(input: string) {
    return this.SCHEME_SET.has(input);
  }
}
