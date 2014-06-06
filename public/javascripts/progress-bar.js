$(document).ready(function () {
  var progress = 0;

  var minDeployTime = 20,
      maxDeployTime = 28,
      intervalTime = 0.5;

  var minProgress = 100 / (maxDeployTime / intervalTime),
      maxProgress = 100 / (minDeployTime / intervalTime);

  var intervalID;

  function increaseProgressBar() {
    var increment = (Math.random() * (maxProgress - minProgress)) + minProgress;
    progress += increment;

    if (progress > 100) {
      window.clearInterval(intervalID);
      $('#deploy-progress').hide();
      if ($('#deploy-status-message').length > 0) {
        $('#deploy-status-message').text('GOV.UK preview updated!');
      }
    }

    $('#deploy-progress .progress-bar').css('width', progress + '%');
  }

  if ($('#deploy-progress').length > 0) {
    intervalID = window.setInterval(increaseProgressBar, intervalTime * 1000);
  }
});
