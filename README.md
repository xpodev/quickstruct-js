# Quick Struct

Quick Struct is a simple and fast way to create cpp structs in TypeScript.

## Installation

```bash
npm install quickstruct
```

## Usage

```typescript
import { Int, Char, Struct, toBytes, fromBytes } from 'quickstruct';

@Struct()
class SimpleStruct {
  int1 = Int();
  char1 = Char();
  char2 = Char();
}

const simpleStruct = new SimpleStruct();
simpleStruct.int1 = 1234;
simpleStruct.char1 = 'a'; // 97
simpleStruct.char2 = 600; // Overflow: 600 % 256 = 88

const bytes = toBytes(simpleStruct);
console.log(bytes);
const simpleStruct2 = fromBytes(SimpleStruct, bytes);
console.log({...simpleStruct2});

console.log(simpleStruct2.int1 + 100);
```
Output:
```bash
[ 210, 0, 0, 0, 97, 88 ]
SimpleStruct { int1: 1234, char1: 'a', char2: 88 }
1334
```

## Types
The following types are supported:
| Type | Description | Displayed as |
| --- | --- | --- |
| Int | 4 byte integer | number |
| Float | 4 byte float | number |
| Char | 1 byte character | string |
| Short | 2 byte integer | number |
| Bool | 1 byte boolean | boolean |
| Null | 1 byte null | null |

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
