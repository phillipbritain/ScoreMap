using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.GameFeed;

public sealed class NascarCarNumberTests
{
    [Theory]
    [InlineData("5", "5")]
    [InlineData(" 24 ", "24")]
    [InlineData("01", "01")]
    public void Valid_numbers_keep_their_digits(string input, string number) => Assert.Equal(number, NascarCarNumber.Parse(input));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1234")]
    [InlineData("5x")]
    [InlineData("../5")]
    public void Anything_but_a_car_number_has_none(string? number) => Assert.Null(NascarCarNumber.Parse(number));
}
