data "aws_region" "current" {}

resource "aws_iam_role" "iam_for_lambda" {
  name = "iam_for_lambda"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.bucket.arn
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/code"
  output_path = "${path.module}/on_s3_put.zip"
}

resource "aws_lambda_function" "function" {
  handler       = "on_s3_put.handler"
  runtime       = "nodejs10.x"
  publish       = "true"
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "on_s3_put"
  role          = aws_iam_role.iam_for_lambda.arn
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout = 10

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.bucket.id,
      REGION = data.aws_region.current.name,
      SLACK_INCOMING_WEBHOOK = var.slack_incoming_webhook
    }
  }

  depends_on = [
      aws_iam_role_policy_attachment.lambda_logs
    ]
}

# See also the following AWS managed policy: AWSLambdaBasicExecutionRole
resource "aws_iam_policy" "lambda_logging" {
  name        = "lambda_logging"
  path        = "/"
  description = "IAM policy for logging from a lambda"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*",
      "Effect": "Allow"
    },
    {
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::${aws_s3_bucket.bucket.id}/api/menu/*",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.iam_for_lambda.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

# # See also the following AWS managed policy: AWSLambdaBasicExecutionRole
# resource "aws_iam_policy" "lambda_put_object" {
#   name        = "lambda_put_object"
#   path        = "/"
#   description = "IAM policy for uploading from a lambda"

#   policy = <<EOF
# {
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Action": [
#         "s3:PutObject",
#         "s3:PutObjectAcl"
#       ],
#       "Resource": "arn:aws:s3:::${aws_s3_bucket.bucket.id}/*",
#       "Effect": "Allow"
#     }
#   ]
# }
# EOF
# }

# resource "aws_iam_role_policy_attachment" "lambda_put_object" {
#   role       = aws_iam_role.iam_for_lambda.name
#   policy_arn = aws_iam_policy.lambda_put_object.arn
# }

# resource "null_resource" "lambda_deployment_source_trigger" {
#   triggers = {
#     lambda_handler_code_file = md5(file("${path.module}/code/on_s3_put.js"))
#   }
# }

resource "aws_s3_bucket" "bucket" {
  bucket = "s3jsondiff"
  acl    = "public-read"

  versioning {
    enabled = true
  }
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.function.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "api/menu/"
    filter_suffix       = "_menu.json"
  }

  depends_on = [aws_lambda_permission.allow_bucket]
}
