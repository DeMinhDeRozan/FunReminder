provider "aws" {
  region = "ap-southeast-2"
}

data "aws_s3_bucket" "reminderyoubro" {
  bucket = "reminderyoubro" 
}

resource "aws_s3_bucket_public_access_block" "example" {
  bucket = data.aws_s3_bucket.reminderyoubro.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "mate_web_config" {
  bucket = data.aws_s3_bucket.reminderyoubro.id
  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket = data.aws_s3_bucket.reminderyoubro.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAccessFromSpecificVPC"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${data.aws_s3_bucket.reminderyoubro.arn}/*"
        Condition = {
          StringEquals = {
            "aws:SourceVpc" = "vpc-05a0e416b3fffccf7"
          }
        }
      },
      {
        Sid       = "AllowAdminFullAccess"
        Effect    = "Allow"
        Principal = {
          AWS = "arn:aws:iam::231104905494:user/deminh17"
        }
        Action    = "s3:*"
        Resource  = [
          "${data.aws_s3_bucket.reminderyoubro.arn}",
          "${data.aws_s3_bucket.reminderyoubro.arn}/*"
        ]
      }
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.example]
}

resource "aws_s3_object" "upload_index" {
  bucket       = data.aws_s3_bucket.reminderyoubro.id
  key          = "index.html"
  source       = "../Web/index.html"
  content_type = "text/html"
  etag         = filemd5("../Web/index.html")
}

resource "aws_s3_object" "upload_audio" {
  bucket       = data.aws_s3_bucket.reminderyoubro.id
  key          = "audio.mp3" 
  source       = "../Web/audio.mp3"  
  content_type = "audio/mpeg"        
  etag         = filemd5("../Web/audio.mp3")
}

output "website_url" {
  value = aws_s3_bucket_website_configuration.mate_web_config.website_endpoint
}

#deminhderozan