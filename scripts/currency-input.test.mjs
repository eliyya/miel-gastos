import assert from 'node:assert/strict'
import test from 'node:test'

import {
    currencyCaret,
    currencyDecimal,
    currencyDigits,
    currencyDisplay,
} from '../src/lib/currency-input.ts'
import { parseMoneyToCents } from '../src/lib/format.ts'

test('typing 5300 shifts digits through the cents without a decimal key', () => {
    let display = '0.00'
    for (const [key, expected] of [
        ['5', '0.05'],
        ['3', '0.53'],
        ['0', '5.30'],
        ['0', '53.00'],
    ]) {
        display = currencyDisplay(currencyDigits(display + key))
        assert.equal(display, expected)
    }
})

test('backspace reverses cents entry and clearing returns to zero', () => {
    let display = '53.00'
    for (const expected of ['5.30', '0.53', '0.05', '0.00']) {
        display = currencyDisplay(currencyDigits(display.slice(0, -1)))
        assert.equal(display, expected)
    }
    assert.equal(currencyDisplay(currencyDigits('')), '0.00')
    assert.equal(currencyDisplay(currencyDigits('0000')), '0.00')
})

test('pasted currency and thousand separators preserve the decimal value submitted to the server', () => {
    const digits = currencyDigits('$1,234.56 MXN')
    assert.equal(currencyDisplay(digits), '1,234.56')
    assert.equal(currencyDecimal(digits), '1234.56')
    assert.equal(parseMoneyToCents(currencyDecimal(digits)), 123456)
    assert.equal(parseMoneyToCents(currencyDecimal(currencyDigits('5'))), 5)
    assert.equal(parseMoneyToCents(currencyDecimal(currencyDigits('5300'))), 5300)
    assert.equal(parseMoneyToCents(currencyDecimal('')), null)
})

test('caret positioning preserves edits next to decimal and thousand separators', () => {
    assert.equal(currencyCaret('1,234.56', 0), 8)
    assert.equal(currencyCaret('1,234.56', 2), 6)
    assert.equal(currencyCaret('1,234.56', 5), 2)
    assert.equal(currencyCaret('0.05', 100), 0)
})
