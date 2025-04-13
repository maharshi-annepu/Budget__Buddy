const Income = require("../models/Income");
const Expense = require("../models/Expense");
const { isValidObjectId, Types } = require("mongoose");

exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    const userObjectId = new Types.ObjectId(userId);

    // 1. Total Income
    const totalIncomeAgg = await Income.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalIncome = totalIncomeAgg[0]?.total || 0;

    // 2. Total Expense
    const totalExpenseAgg = await Expense.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpense = totalExpenseAgg[0]?.total || 0;

    // 3. Last 60 Days Income
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const last60DaysIncomeTransactions = await Income.find({
      userId,
      date: { $gte: sixtyDaysAgo },
    }).sort({ date: -1 });

    const incomeLast60Days = last60DaysIncomeTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );

    // 4. Last 30 Days Expenses
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30DaysExpenseTransactions = await Expense.find({
      userId,
      date: { $gte: thirtyDaysAgo },
    }).sort({ date: -1 });

    const expensesLast30Days = last30DaysExpenseTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );

    // 5. Recent 5 transactions (income + expenses)
    const incomeTxns = await Income.find({ userId }).sort({ date: -1 }).limit(5);
    const expenseTxns = await Expense.find({ userId }).sort({ date: -1 }).limit(5);

    const lastTransactions = [
      ...incomeTxns.map((txn) => ({ ...txn.toObject(), type: "income" })),
      ...expenseTxns.map((txn) => ({ ...txn.toObject(), type: "expense" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // 6. Final Response
    res.json({
      totalBalance: totalIncome - totalExpense,
      totalIncome,
      totalExpenses: totalExpense,
      last30DaysExpenses: {
        total: expensesLast30Days,
        transactions: last30DaysExpenseTransactions,
      },
      last60DaysIncome: {
        total: incomeLast60Days,
        transactions: last60DaysIncomeTransactions,
      },
      recentTransactions: lastTransactions,
    });
  } catch (error) {
    console.error("Dashboard Error: ", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
