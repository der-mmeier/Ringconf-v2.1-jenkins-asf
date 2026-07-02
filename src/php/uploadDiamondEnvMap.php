<?php

$target_file = "assets/img3d/diamondEnvMap.env";
$uploadOk = 1;
$imageFileType = strtolower(pathinfo($target_file,PATHINFO_EXTENSION));

if($imageFileType != "env") {
  echo "Sorry, only ENV files are allowed.";
  $uploadOk = 0;
}

if ($uploadOk == 0) {
  echo "Sorry, your file was not uploaded.";
} else {
  if (move_uploaded_file($_FILES["diamondEnvMap"]["tmp_name"], $target_file)) {
    echo "The file ". htmlspecialchars( basename( $_FILES["diamondEnvMap"]["name"])). " has been uploaded.";
  } else {
    echo "Sorry, there was an error uploading your file.";
  }
}
