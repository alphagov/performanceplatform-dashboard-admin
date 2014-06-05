$(document).ready(function () {
  var progress = 0;

  var minDeployTime = 18,
      maxDeployTime = 24,
      intervalTime = 0.5;

  var minProgress = 100 / (maxDeployTime / intervalTime),
      maxProgress = 100 / (minDeployTime / intervalTime);

  var intervalID;

  function increaseProgressBar() {
    var increment = (Math.random() * (maxProgress - minProgress)) + minProgress;
    progress += increment;

    if (progress > 100) {
      window.clearInterval(intervalID);
    }

    $('#deploy-progress .progress-bar').css('width', progress + '%');
  }

  if ($('#deploy-progress').length > 0) {
    intervalID = window.setInterval(increaseProgressBar, intervalTime * 1000);
  }
});
