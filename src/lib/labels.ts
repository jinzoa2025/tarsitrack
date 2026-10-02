import type { TransactionType } from './data'

export const expenseTypes = ['expense', 'loan_payment', 'card_payment']
export const transferTypes = ['goal_deposit', 'wish_contribution', 'transfer']
export const txLabels: Record<TransactionType, string> = {
  income: 'Income', expense: 'Expense', loan_payment: 'Loan payment', card_payment: 'Card payment',
  goal_deposit: 'Savings deposit', wish_contribution: 'Wishlist contribution', transfer: 'Transfer', adjustment: 'Adjustment',
}
