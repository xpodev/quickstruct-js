export function toBytes(obj: any): Uint8Array {
  const byteArray = Object.values(obj).reduce((acc: number[], value) => {
    if (value instanceof DataType) {
      acc.push(...value.toBytes());
    }
    return acc;
  }, []);

  return new Uint8Array(byteArray);
}

export function fromBytes<T>(cls: Type<T>, bytes: Uint8Array, { asJson = true} = {}): T {
  const obj = new cls();
  let offset = 0;

  for (const key in obj) {
    if (obj[key] instanceof DataType) {
      const dataType = obj[key] as DataType<any>;
      const [value, size] = dataType.fromBytes(bytes.slice(offset));
      obj[key] = value;
      offset += size;
    }
  }

  if (asJson) {
    return JSON.parse(JSON.stringify(obj));
  }

  return obj;
}

type Struct = {
  [key: string]: DataType<any> | number | string | boolean | null;
};

function StructDecorator() {
  return function <T extends Type<any>>(
    target: T,
    ...args: any[]
  ): T & Type<Struct> {
    return class extends target {
      constructor(...args: any[]) {
        super(...args);
        return new Proxy(this, {
          set: function (obj, prop: string, value) {
            if (prop in obj && obj[prop] instanceof DataType) {
              (obj[prop] as DataType<any>).value = value;
            } else {
              obj[prop] = value;
            }
            return true;
          },
        });
      }
    };
  };
}

export const Struct = StructDecorator;

type Type<T> = {
  new (...args: any[]): T;
};

abstract class DataType<T> {
  constructor(public readonly size: number) {
    this.bytes = new Uint8Array(this.size);
    return new Proxy(this, {
      get: function (obj, prop: string) {
        if (prop in obj) {
          return obj[prop as keyof DataType<T>];
        } else if (obj.value) {
          const requestedValue = obj.value[prop as keyof T];
          if (typeof requestedValue === "function") {
            return requestedValue.bind(obj.value);
          }
          return requestedValue;
        }
      }
    });
  }

  public readonly bytes: Uint8Array;
  abstract readonly type: DataTypeEnum | ((value: any) => boolean);
  abstract value: T;
  abstract validate(value: any): boolean;
  abstract toBytes(): Uint8Array;
  abstract fromBytes(bytes: Uint8Array): [T, number];

  valueOf() {
    return this.value;
  }

  toString() {
    return `${this.value}`;
  }

  toJSON() {
    return this.value;
  }
}

const enum DataTypeEnum {
  Number = "number",
  String = "string",
  Boolean = "boolean",
  Null = "null",
}

function makeDataType<T>(
  validateFunction: (value: T) => boolean,
  size: number,
  dataType: DataTypeEnum = DataTypeEnum.Number
): () => T {
  class ScalarDataType extends DataType<T> {
    private _value!: T;

    constructor() {
      super(size);
    }

    validate(value: T): boolean {
      if (validateFunction(value)) {
        this._value = value;
        return true;
      }

      return false;
    }

    toBytes(): Uint8Array {
      return this.bytes;
    }

    fromBytes(bytes: Uint8Array): [T, number] {
      const value = bytes.slice(0, this.size);
      this.bytes.set(value);
      switch (this.type) {
        case DataTypeEnum.Number:
          this.value = this.bytes.reduce((acc, byte, index) => {
            acc += byte << (index * 8);
            return acc;
          }, 0) as any;
          break;
        case DataTypeEnum.String:
          this.value = this.bytes.reduce((acc, byte) => {
            acc += String.fromCharCode(byte);
            return acc;
          }, "") as any;
          break;
        case DataTypeEnum.Boolean:
          this.value = (new Uint8Array(this.bytes.buffer)[0] === 1) as any;
          break;
        case DataTypeEnum.Null:
          this.value = null as any;
          break;
      }

      return [this.value, this.size];
    }

    get type() {
      return dataType;
    }

    get value(): T {
      return this._value;
    }

    set value(value: T) {
      if (!this.validate(value)) {
        throw new Error("Invalid value");
      }

      this.bytes.fill(0);

      switch (true) {
        case typeof value === "number":
          if (Number.isInteger(value)) {
            this.bytes.set(new Uint32Array([value]));
          } else {
            this.bytes.set(new Float64Array([value]));
          }
          break;
        case typeof value === "string":
          this.bytes.set(
            new Uint8Array(value.split("").map((char) => char.charCodeAt(0)))
          );
          break;
        case typeof value === "boolean":
          this.bytes.set(new Uint8Array([value ? 1 : 0]));
          break;
        case value === null:
          this.bytes.set(new Uint8Array([0]));
          break;
        default:
          throw new Error(
            "Can only use scalar data types with numbers, strings, booleans, and nulls"
          );
      }

      this._value = value;
    }

    private readonly MAX_VALUE = (1 << (this.size * 8)) - 1;
  }

  return Object.assign(function () {
    return new ScalarDataType();
  }, ScalarDataType) as () => any;
}

/**
 * Bool is a 1 byte size, represented as a boolean
 */
export const Bool = makeDataType(
  (value: boolean | number) => {
    return (
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isInteger(value))
    );
  },
  1,
  DataTypeEnum.Boolean
);

/**
 * Char is a single character, 1 byte size, represented as a string
 */
export const Char = makeDataType(
  (value: string | number) => {
    return (
      typeof value === "string" ||
      (typeof value === "number" && Number.isInteger(value))
    );
  },
  1,
  DataTypeEnum.String
);

/**
 * Byte is the same as a char, 1 byte size, but represented as a number
 */
export const Byte = makeDataType(
  (value: string | number) => {
    return (
      typeof value === "string" ||
      (typeof value === "number" && Number.isInteger(value))
    );
  },
  1,
  DataTypeEnum.Number
);

/**
 * Short is a 2 byte size, represented as a number
 */
export const Short = makeDataType((value: number) => {
  return Number.isInteger(value);
}, 2);

/**
 * Int is a 4 byte size, represented as a number
 */
export const Int = makeDataType((value: number) => {
  return Number.isInteger(value);
}, 4);

/**
 * Float is a 4 byte size, represented as a number
 */
export const Float = makeDataType((value: number) => {
  return typeof value === "number";
}, 4);

/**
 * Long is a 8 byte size, represented as a number
 */
export const Long = makeDataType((value: number) => {
  return Number.isInteger(value);
}, 8);

/**
 * Double is a 8 byte size, represented as a number
 */
export const Double = makeDataType((value: number) => {
  return typeof value === "number";
}, 8);

/**
 * LongLong is a 16 byte size, represented as a number
 */
export const LongLong = makeDataType((value: number) => {
  return Number.isInteger(value);
}, 16);

/**
 * LongDouble is a 16 byte size, represented as a number
 */
export const LongDouble = makeDataType((value: number) => {
  return typeof value === "number";
}, 16);

export const Null = makeDataType(
  (value: null) => {
    return value === null;
  },
  1,
  DataTypeEnum.Null
);

class _Str extends DataType<string> {
  constructor() {
    super(0);
    this.bytes = new Uint8Array();
  }

  bytes: Uint8Array;
  
  private _value!: string;
  type = DataTypeEnum.String;
  
  validate(value: any): boolean {
    return typeof value === "string";
  }

  toBytes(): Uint8Array {
    const bytes = new Uint8Array(this.value.length + 1);
    bytes.set(new Uint8Array(this.value.split("").map((char) => char.charCodeAt(0))));
    bytes.set(new Uint8Array([0]), this.value.length);
    return bytes;
  }

  fromBytes(bytes: Uint8Array): [string, number] {
    let size = 0;
    let value = "";
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        size = i;
        break;
      }
      value += String.fromCharCode(bytes[i]);
    }
    this.value = value;
    return [value, size + 1];
  }

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    this._value = value;
  }
  
}

export const Str = Object.assign(function() { return new _Str(); }, _Str) as () => any;