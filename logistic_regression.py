import numpy as np


class LogisticRegression:
    def __init__(self, lr=0.01, n_iters=1000, fit_intercept=True):
        self.lr = lr
        self.n_iters = n_iters
        self.fit_intercept = fit_intercept
        self.weights = None
        self.bias = None

    def _sigmoid(self, z):
        z = np.clip(z, -500, 500)
        return 1 / (1 + np.exp(-z))

    def fit(self, X, y):
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0

        if self.fit_intercept:
            X = np.c_[np.ones(n_samples), X]

        w = np.zeros(n_features + (1 if self.fit_intercept else 0))

        for _ in range(self.n_iters):
            z = X @ w
            y_hat = self._sigmoid(z)
            error = y_hat - y
            grad = (1 / n_samples) * (X.T @ error)
            w -= self.lr * grad

        if self.fit_intercept:
            self.bias = w[0]
            self.weights = w[1:]
        else:
            self.weights = w

    def predict_proba(self, X):
        z = X @ self.weights + self.bias
        return self._sigmoid(z)

    def predict(self, X, threshold=0.5):
        return (self.predict_proba(X) >= threshold).astype(int)


if __name__ == "__main__":
    from sklearn.datasets import make_classification
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score

    X, y = make_classification(
        n_samples=1000, n_features=10, n_informative=5, random_state=42
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = LogisticRegression(lr=0.1, n_iters=1000)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
