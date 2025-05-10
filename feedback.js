$(document).ready(function () {
    let selectedRating = 0;

    $(".star").on("mouseover", function () {
        const value = $(this).data("value");
        highlightStars(value);
    });

    $(".star").on("mouseout", function () {
        highlightStars(selectedRating);
    });

    $(".star").on("click", function () {
        selectedRating = $(this).data("value");
        $("#ratingValue").text(selectedRating);
        $("#designRating").val(selectedRating);
    });

    function highlightStars(rating) {
        $(".star").each(function () {
            $(this).toggleClass("selected", $(this).data("value") <= rating);
        });
    }

    $("#feedbackForm").on("submit", function (e) {
        e.preventDefault();

        if (selectedRating <= 0) {
            alert("Please select a rating before submitting.");
            return;
        }

        const feedbackData = {
            likedMost: $("#likedMost").val(),
            designRating: selectedRating,
            additionalFeatures: $("#additionalFeatures").val(),
            bugs: $("#bugs").val(),
            experience: $("#experience").val(),
            suggestions: $("#suggestions").val(),
            submittedAt: new Date()
        };

        // Save to Firestore anonymously
        firebase.firestore().collection("anonymousFeedback").add(feedbackData)
            .then(() => {
                alert("Thank you for your feedback!");
                window.location.href = "thank.html";
            })
            .catch((error) => {
                console.error("Error saving feedback: ", error);
                alert("There was an error saving your feedback. Please try again.");
            });
    });
});
