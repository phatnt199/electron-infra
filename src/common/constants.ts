export class ExposeVerbs {
  static readonly HANDLER = 'handler';
  static readonly SUBSCRIBER = 'subscriber';

  static readonly SCHEME_SET = new Set([this.HANDLER, this.SUBSCRIBER]);

  static isValid(input: string) {
    return this.SCHEME_SET.has(input);
  }
}
