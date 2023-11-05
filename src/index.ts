export function toBytes(obj: any): Uint8Array {
  const byteArray = Object.values(obj).reduce((acc: number[], value) => {
    if (value instanceof DataType) {
      acc.push(...new Uint8Array(value.bytes));
    }
    return acc;
  }, []);

  return new Uint8Array(byteArray);
}

export function fromBytes<T>(cls: Type<T>, bytes: Uint8Array): T {
  const obj = new cls();
  let offset = 0;

  for (const key in obj) {
    if (obj[key] instanceof DataType) {
      const dataType = obj[key] as DataType<any>;
      const value = bytes.slice(offset, offset + dataType.size);
      dataType.bytes.set(value);
      switch (dataType.type) {
        case DataTypeEnum.Number:
          obj[key] = dataType.bytes.reduce((acc, byte, index) => {
            acc += byte << (index * 8);
            return acc;
          }, 0) as any;
          break;
        case DataTypeEnum.String:
          obj[key] = dataType.bytes.reduce((acc, byte) => {
            acc += String.fromCharCode(byte);
            return acc;
          }, "") as any;
          break;
        case DataTypeEnum.Boolean:
          obj[key] = (new Uint8Array(dataType.bytes.buffer)[0] === 1) as any;
          break;
        case DataTypeEnum.Null:
          obj[key] = null as any;
          break;
      }
      offset += dataType.size;
    }
  }

  return obj;
}

type Struct = {
  [key: string]: DataType<any> | number | string | boolean | null;
};

export function StructDecorator() {
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
  }

  public readonly bytes: Uint8Array;
  abstract readonly type: DataTypeEnum;
  abstract value: T;
  abstract validate(value: any): boolean;

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

export const Int = makeDataType((value: number) => {
  return Number.isInteger(value);
}, 4);

export const Float = makeDataType((value: number) => {
  return typeof value === "number";
}, 8);

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

export const Short = makeDataType((value: number) => {
  return Number.isInteger(value);
}, 2);

export const Boolean = makeDataType(
  (value: boolean | number) => {
    return (
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isInteger(value))
    );
  },
  1,
  DataTypeEnum.Boolean
);

export const Null = makeDataType(
  (value: null) => {
    return value === null;
  },
  1,
  DataTypeEnum.Null
);
