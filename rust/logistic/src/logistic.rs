use ndarray::prelude::*;

pub struct LogisticRegression {
    weight: Array1<f64>
}

fn sigmoid(x: f64) -> f64 {
    1. / (1. + x.exp())
}

fn logit(x: f64) -> f64 {
    (x / (1. - x)).ln()
}

// fn cel(n: u64, )

#[cfg(test)]
mod tests{
    use super::*;

    #[test]
    fn test_sigmoid() {
        let val = sigmoid(1.2);
        println!("{:}", val) 
    }
}