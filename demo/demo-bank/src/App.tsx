import {
  createDepositCompletedPath,
  createDepositConfirmationPath,
  createDepositConditionsPath,
  createDepositPasswordPath,
  createDepositProductDetailPath,
  createDepositTermsPath,
  createTransferAmountPath,
  createTransferCompletedPath,
  createTransferConfirmationPath,
  createTransferOtpPath,
  createTransferPasswordPath,
  createTransferRecipientsPath,
  normalizePathname,
  ROUTES
} from './constants/routes';
import { demoAccounts, depositProducts } from './data/demo-data';
import { transferRecipients } from './data/transfer-recipients';
import DepositAmountPage from './pages/DepositAmountPage';
import DepositCompletionPage from './pages/DepositCompletionPage';
import DepositConfirmationPage from './pages/DepositConfirmationPage';
import DepositPasswordPage from './pages/DepositPasswordPage';
import DepositProductDetailPage from './pages/DepositProductDetailPage';
import DepositProductsPage from './pages/DepositProductsPage';
import DepositTermsPage from './pages/DepositTermsPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import TransferAccountsPage from './pages/TransferAccountsPage';
import TransferAmountPage from './pages/TransferAmountPage';
import TransferConfirmationPage from './pages/TransferConfirmationPage';
import TransferCompletionPage from './pages/TransferCompletionPage';
import TransferOtpPage from './pages/TransferOtpPage';
import TransferPasswordPage from './pages/TransferPasswordPage';
import TransferRecipientsPage from './pages/TransferRecipientsPage';

export default function App() {
  const currentPath = normalizePathname(window.location.pathname);
  const detailProduct = depositProducts.find(
    (product) =>
      createDepositProductDetailPath(product.id) === currentPath
  );
  const conditionsProduct = depositProducts.find(
    (product) =>
      createDepositConditionsPath(product.id) === currentPath
  );
  const termsProduct = depositProducts.find(
    (product) => createDepositTermsPath(product.id) === currentPath
  );
  const passwordProduct = depositProducts.find(
    (product) => createDepositPasswordPath(product.id) === currentPath
  );
  const confirmationProduct = depositProducts.find(
    (product) => createDepositConfirmationPath(product.id) === currentPath
  );
  const completedProduct = depositProducts.find(
    (product) => createDepositCompletedPath(product.id) === currentPath
  );
  const transferAccount = demoAccounts.find(
    (account) =>
      createTransferRecipientsPath(account.id) === currentPath
  );
  const transferAmountContext = demoAccounts
    .flatMap((account) =>
      transferRecipients.map((recipient) => ({ account, recipient }))
    )
    .find(
      ({ account, recipient }) =>
        createTransferAmountPath(account.id, recipient.id) === currentPath
    );
  const transferPasswordContext = demoAccounts
    .flatMap((account) =>
      transferRecipients.map((recipient) => ({ account, recipient }))
    )
    .find(
      ({ account, recipient }) =>
        createTransferPasswordPath(account.id, recipient.id) === currentPath
    );
  const transferOtpContext = demoAccounts
    .flatMap((account) =>
      transferRecipients.map((recipient) => ({ account, recipient }))
    )
    .find(
      ({ account, recipient }) =>
        createTransferOtpPath(account.id, recipient.id) === currentPath
    );
  const transferConfirmationContext = demoAccounts
    .flatMap((account) =>
      transferRecipients.map((recipient) => ({ account, recipient }))
    )
    .find(
      ({ account, recipient }) =>
        createTransferConfirmationPath(account.id, recipient.id) ===
        currentPath
    );
  const transferCompletedContext = demoAccounts
    .flatMap((account) =>
      transferRecipients.map((recipient) => ({ account, recipient }))
    )
    .find(
      ({ account, recipient }) =>
        createTransferCompletedPath(account.id, recipient.id) ===
        currentPath
    );

  if (completedProduct) {
    return <DepositCompletionPage product={completedProduct} />;
  }

  if (confirmationProduct) {
    return <DepositConfirmationPage product={confirmationProduct} />;
  }

  if (transferCompletedContext) {
    return (
      <TransferCompletionPage
        account={transferCompletedContext.account}
        recipient={transferCompletedContext.recipient}
      />
    );
  }

  if (transferConfirmationContext) {
    return (
      <TransferConfirmationPage
        account={transferConfirmationContext.account}
        recipient={transferConfirmationContext.recipient}
      />
    );
  }

  if (transferOtpContext) {
    return (
      <TransferOtpPage
        account={transferOtpContext.account}
        recipient={transferOtpContext.recipient}
      />
    );
  }

  if (transferPasswordContext) {
    return (
      <TransferPasswordPage
        account={transferPasswordContext.account}
        recipient={transferPasswordContext.recipient}
      />
    );
  }

  if (transferAmountContext) {
    return (
      <TransferAmountPage
        account={transferAmountContext.account}
        recipient={transferAmountContext.recipient}
      />
    );
  }

  if (transferAccount) {
    return <TransferRecipientsPage account={transferAccount} />;
  }

  if (passwordProduct) {
    return <DepositPasswordPage product={passwordProduct} />;
  }

  if (termsProduct) {
    return <DepositTermsPage product={termsProduct} />;
  }

  if (conditionsProduct) {
    return <DepositAmountPage product={conditionsProduct} />;
  }

  if (detailProduct) {
    return <DepositProductDetailPage product={detailProduct} />;
  }

  switch (currentPath) {
    case ROUTES.HOME:
      return <HomePage />;
    case ROUTES.DEPOSIT_PRODUCTS:
      return <DepositProductsPage />;
    case ROUTES.TRANSFER_ACCOUNTS:
      return <TransferAccountsPage />;
    default:
      return <NotFoundPage currentPath={currentPath} />;
  }
}
